fn main() {
    // PE VersionInfo for a clean Authenticode-ready binary (no packers, no runtime downloads).
    // Fields match the product brief: CompanyName, ProductName, FileVersion, ProductVersion.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set("CompanyName", "tedeshi");
        res.set("ProductName", "Seans");
        res.set("FileDescription", "Seans Windows media client");
        res.set("FileVersion", "0.1.0");
        res.set("ProductVersion", "0.1.0");
        res.set("LegalCopyright", "tedeshi");
        res.set("OriginalFilename", "seans.exe");
        res.set("InternalName", "seans");
        if let Err(err) = res.compile() {
            eprintln!("winresource compile warning: {err}");
        }
    }

    tauri_build::build()
}
