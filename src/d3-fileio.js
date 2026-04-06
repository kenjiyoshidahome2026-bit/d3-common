import * as d3 from 'd3';

Object.assign(d3.selection.prototype, {
    dropFiles(func, opts) { return dropFiles(this, func, opts); },
    dropFile(func, opts) { return dropFile(this, func, opts); },
    selectFiles(func, opts) { return selectFiles(this, func, opts); },
    selectFile(func, opts) { return selectFile(this, func, opts); }
});

const getFileRelativePath = (file, entry) => {// ファイルパスの正規化
    if (file.webkitRelativePath) return file.webkitRelativePath.replace(/\/[^/]*$/, "");
    if (entry && entry.fullPath) return entry.fullPath.replace(new RegExp(`${entry.name}$`), "").replace(/^\/|\/$/g, "");
    return "";
};

async function dropFiles(self, func, opts = {}) {
    return self.on("dragover", e => e.preventDefault()).on("drop", drop);
    async function drop(e) {
        e.preventDefault();
        if (self.property("disabled") || self.attr("disabled")) return;
        const items = Array.from(e.dataTransfer.items || []);
        if (!items.length) return;
        const entries = [];
        const scan = async (entry) => { if (!entry) return;
            if (entry.isFile) { entries.push(entry);
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                 const readAll = async () => {
                    const results = await new Promise(res => reader.readEntries(res));
                    if (results.length > 0) { await Promise.all(results.map(scan)); await readAll();}
                };
                await readAll();
            }
        };
        await Promise.all(items.map(item => scan(item.webkitGetAsEntry())));
        let files = await Promise.all(entries.map(entry => 
            new Promise(res => entry.file(f => { f.path = getFileRelativePath(f, entry); res(f); }))
        ));
        if (typeof func === "function") func(files);
    };
}
function dropFile(self, func, opts = {}) {
    return self.on("dragover", e => e.preventDefault()).on("drop", drop);
    function drop(e) {
        e.preventDefault();
        if (self.property("disabled") || self.attr("disabled")) return;
        handleSimpleFiles(Array.from(e.dataTransfer.files), func, opts);
    }
}

function selectFiles(self, func, opts = {}) {
    return self.on("click", () => {
        const input = d3.select("body").append("input")
            .attr("type", "file")
            .attr("webkitdirectory", "")
            .attr("multiple", "")
            .style("display", "none")
            .on("change", e => {
                const files = Array.from(e.target.files).map(f => {
                    f.path = getFileRelativePath(f);
                    return f;
                });
                if (typeof func === "function") func(files);
                input.remove();
            });
        input.node().click();
    });
}
function selectFile(self, func, opts = {}) {
    return self.on("click", () => {
        const input = d3.select("body").append("input")
            .attr("type", "file")
            .style("display", "none")
            .attr("multiple", opts.multi ? "" : null)
            .attr("accept", opts.filter || null)
            .on("change", e => {
                const files = Array.from(e.target.files);
                handleSimpleFiles(files, func, opts);
                input.remove();
            });
        input.node().click();
    });
}

function handleSimpleFiles(files, func, opts) {
    if (opts.imageOnly) files = files.filter(f => f.type.startsWith("image/"));
    if (files.length && typeof func === "function") {
        func(opts.multi ? files : files[0]);
    }
}
//------------------------------------------------------------------------
let projectDirHandle = null;
d3.download = download;
d3.saveTo = saveTo;

function download(blob, name) {
    name = name || blob.name || "download";
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => {URL.revokeObjectURL(url); document.body.removeChild(a);}, 1000);
};

async function saveTo(blob, name) {
    const setProjectFolder = async () => projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (!projectDirHandle) await setProjectFolder();
    const fileHandle = await projectDirHandle.getFileHandle(blob.name || name || "download", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    console.log(`Saved ${name} to project folder.`);
}
