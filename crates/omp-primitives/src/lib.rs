use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

#[cfg(feature = "omp-walker")]
use pi_walker::{WalkDetail, WalkFilter, WalkRequest};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PrimitiveBackend {
    OmpPiWalker,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceFile {
    /// Slash-normalized path relative to the scan root.
    pub relative_path: String,
    pub size_bytes: Option<u64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WorkspaceScanOptions {
    pub include_hidden: bool,
    pub use_gitignore: bool,
    pub skip_git: bool,
    pub skip_node_modules: bool,
    pub max_depth: usize,
    pub limit: Option<usize>,
    pub use_cache: bool,
}

impl Default for WorkspaceScanOptions {
    fn default() -> Self {
        Self {
            include_hidden: false,
            use_gitignore: true,
            skip_git: true,
            skip_node_modules: true,
            max_depth: usize::MAX,
            limit: None,
            use_cache: true,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceScan {
    pub backend: PrimitiveBackend,
    pub files: Vec<WorkspaceFile>,
    pub scanned_entries: usize,
    pub filtered_entries: usize,
    pub limited_entries: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorkspaceScanError {
    BackendDisabled,
    ScanFailed(String),
    WorkerFailed(String),
}

impl fmt::Display for WorkspaceScanError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BackendDisabled => formatter.write_str(
                "OMP pi-walker backend is disabled; enable the `omp-walker` Cargo feature",
            ),
            Self::ScanFailed(message) => write!(formatter, "OMP pi-walker scan failed: {message}"),
            Self::WorkerFailed(message) => {
                write!(formatter, "OMP pi-walker blocking worker failed: {message}")
            }
        }
    }
}

impl Error for WorkspaceScanError {}

/// Scan workspace files through the pinned OMP `pi-walker` primitive.
///
/// This is deliberately a filesystem-only adapter. It exposes no OMP agent,
/// provider, session, prompt, command, or plugin type. When its Cargo feature
/// is disabled, Paseo's existing file-observation path remains the fallback.
#[cfg(feature = "omp-walker")]
pub async fn scan_workspace_files(
    root: PathBuf,
    options: WorkspaceScanOptions,
) -> Result<WorkspaceScan, WorkspaceScanError> {
    tokio::task::spawn_blocking(move || scan_workspace_files_blocking(&root, options))
        .await
        .map_err(|error| WorkspaceScanError::WorkerFailed(error.to_string()))?
}

#[cfg(feature = "omp-walker")]
fn scan_workspace_files_blocking(
    root: &Path,
    options: WorkspaceScanOptions,
) -> Result<WorkspaceScan, WorkspaceScanError> {
    let request = WalkRequest::new(root)
        .hidden(options.include_hidden)
        .gitignore(options.use_gitignore)
        .skip_git(options.skip_git)
        .skip_node_modules(options.skip_node_modules)
        .detail(WalkDetail::Full)
        .depth(1, options.max_depth)
        .cache(options.use_cache)
        .filter(WalkFilter::files_only());
    let request = match options.limit {
        Some(limit) => request.limit(limit),
        None => request,
    };
    let outcome = request
        .collect()
        .map_err(|error| WorkspaceScanError::ScanFailed(error.to_string()))?;
    let mut files = outcome
        .entries
        .into_iter()
        .map(|entry| WorkspaceFile {
            relative_path: entry.path,
            size_bytes: entry.size.map(|size| size as u64),
        })
        .collect::<Vec<_>>();
    files.sort_unstable_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(WorkspaceScan {
        backend: PrimitiveBackend::OmpPiWalker,
        files,
        scanned_entries: outcome.stats.scanned_entries,
        filtered_entries: outcome.stats.filtered_entries,
        limited_entries: outcome.stats.limited_entries,
    })
}

#[cfg(not(feature = "omp-walker"))]
pub async fn scan_workspace_files(
    _root: PathBuf,
    _options: WorkspaceScanOptions,
) -> Result<WorkspaceScan, WorkspaceScanError> {
    Err(WorkspaceScanError::BackendDisabled)
}

/// Invalidate OMP's shared scan cache after a watcher reports a file create,
/// write, remove, or rename. Returns false when the backend is not compiled in.
#[cfg(feature = "omp-walker")]
pub fn invalidate_workspace_path(path: &Path) -> bool {
    pi_walker::invalidate_path(path);
    true
}

#[cfg(not(feature = "omp-walker"))]
pub fn invalidate_workspace_path(_path: &Path) -> bool {
    false
}

#[cfg(test)]
mod tests {
    #[cfg(feature = "omp-walker")]
    use std::fs;
    #[cfg(not(feature = "omp-walker"))]
    use std::path::PathBuf;
    #[cfg(feature = "omp-walker")]
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(not(feature = "omp-walker"))]
    use super::WorkspaceScanError;
    use super::{WorkspaceScanOptions, scan_workspace_files};

    #[cfg(not(feature = "omp-walker"))]
    #[tokio::test]
    async fn disabled_feature_has_an_explicit_fallback_signal() {
        let error = scan_workspace_files(PathBuf::from("."), WorkspaceScanOptions::default())
            .await
            .expect_err("disabled backend must not silently use different semantics");
        assert_eq!(error, WorkspaceScanError::BackendDisabled);
    }

    #[cfg(feature = "omp-walker")]
    #[tokio::test]
    async fn omp_walker_honors_ignore_and_pruning_boundaries() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time after epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("chw-omp-walker-{unique}"));
        fs::create_dir_all(root.join("src")).expect("create source directory");
        fs::create_dir_all(root.join("node_modules/pkg")).expect("create dependency directory");
        fs::create_dir_all(root.join(".git/objects")).expect("create git metadata directory");
        fs::write(root.join("src/keep.rs"), b"fn main() {}\n").expect("write kept file");
        fs::write(root.join("ignored.txt"), b"ignore me\n").expect("write ignored file");
        fs::write(root.join(".hidden.txt"), b"hidden\n").expect("write hidden file");
        fs::write(root.join("node_modules/pkg/index.js"), b"module\n")
            .expect("write dependency file");
        fs::write(root.join(".git/objects/object"), b"git\n").expect("write git file");
        fs::write(root.join(".gitignore"), b"ignored.txt\n").expect("write ignore rules");

        let scan = scan_workspace_files(
            root.clone(),
            WorkspaceScanOptions {
                use_cache: false,
                ..WorkspaceScanOptions::default()
            },
        )
        .await
        .expect("scan fixture with OMP walker");
        let paths = scan
            .files
            .iter()
            .map(|file| file.relative_path.as_str())
            .collect::<Vec<_>>();
        assert_eq!(paths, vec!["src/keep.rs"]);
        assert_eq!(scan.files[0].size_bytes, Some(13));

        fs::remove_dir_all(&root).expect("remove isolated scan fixture");
    }
}
