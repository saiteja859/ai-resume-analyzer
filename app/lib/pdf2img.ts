// ~/lib/pdf2img.ts
export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any | null = null;

/**
 * Load pdfjs-dist only in the browser and set worker src.
 */
async function loadPdfJs() {
    if (typeof window === "undefined") {
        // Prevent SSR from loading pdfjs
        throw new Error("pdfjs-dist can only be loaded in the browser");
    }

    if (pdfjsLib) return pdfjsLib;

    // dynamic import to avoid SSR issues
    const lib = await import("pdfjs-dist");

    // Vite-compatible worker import (only .mjs?url works in your setup)
    try {
        const workerModule = await import(
            "pdfjs-dist/build/pdf.worker.min.mjs?url"
            );
        lib.GlobalWorkerOptions.workerSrc =
            (workerModule && (workerModule.default ?? workerModule)) as string;
    } catch (err) {
        console.error("Failed to load pdf.worker.min.mjs", err);
    }

    pdfjsLib = lib;
    return lib;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    if (typeof window === "undefined") {
        return {
            imageUrl: "",
            file: null,
            error: "PDF conversion is only available in the browser.",
        };
    }

    try {
        const lib = await loadPdfJs();

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2 }); // scale=2 for balance between quality & perf
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        if (!context) {
            return { imageUrl: "", file: null, error: "Could not get canvas context." };
        }

        await page.render({ canvasContext: context, viewport }).promise;

        return await new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                0.92
            );
        });
    } catch (err) {
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${String(err)}`,
        };
    }
}
