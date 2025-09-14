import { useState, type FormEvent } from 'react';
import { useNavigate } from "react-router";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import { usePuterStore } from "~/lib/puter";
import { convertPdfToImage } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions } from "~/constants";

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null); // ✅ new state for preview

    const handleFileSelect = (file: File | null) => {
        setFile(file);
        setPreviewUrl(null); // reset preview when selecting new file
    };

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File }) => {
        setIsProcessing(true);
        setStatusText('uploading the file...');

        const uploadedFile = await fs.upload([file]);
        if (!uploadedFile) return setStatusText('Upload failed.');

        setStatusText('converting to image...');
        const imageFile = await convertPdfToImage(file);
        if (!imageFile.file) return setStatusText('Failed to convert PDF to image...');
        setPreviewUrl(imageFile.imageUrl); // ✅ show preview

        setStatusText('uploading image...');
        const uploadedImage = await fs.upload([imageFile.file]);
        if (!uploadedImage) return setStatusText('Failed to upload Image...');

        setStatusText('Preparing data...');

        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName,
            jobTitle,
            jobDescription,
            feedback: '',
        };
        await kv.set(`resume:${uuid}`, JSON.stringify(data));
        setStatusText('Analyzing ...');

        const feedback = await ai.feedback(
            uploadedFile.path,
            prepareInstructions({ jobTitle, jobDescription })
        );
        if (!feedback) return setStatusText('Failed to analyze resume...');

        const feedbackText = typeof feedback.message.content === 'string'
            ? feedback.message.content
            : feedback.message.content[0].text;

        data.feedback = JSON.parse(feedbackText);
        await kv.set(`resume:${uuid}`, JSON.stringify(data));
        setStatusText('Analysis complete redirecting...');
        console.log(data);
        navigate(`/resume/${uuid}`);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if (!file) return;

        await handleAnalyze({ companyName, jobTitle, jobDescription, file });
    };

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />
            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>

                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full" />
                        </>
                    ) : (
                        <>
                            <h2>Drop your Resume for an ATS score and improvement tips</h2>

                            <form
                                id="upload-form"
                                onSubmit={handleSubmit}
                                className="flex flex-col gap-4 mt-8"
                            >
                                <div className="form-div">
                                    <label htmlFor="company-name">Company Name</label>
                                    <input
                                        type="text"
                                        name="company-name"
                                        placeholder="Company Name"
                                        id="company-name"
                                    />
                                </div>

                                <div className="form-div">
                                    <label htmlFor="job-title">Job Title</label>
                                    <input
                                        type="text"
                                        name="job-title"
                                        placeholder="Job Title"
                                        id="job-title"
                                    />
                                </div>

                                <div className="form-div">
                                    <label htmlFor="job-description">Job Description</label>
                                    <textarea
                                        rows={5}
                                        name="job-description"
                                        placeholder="Job Description"
                                        id="job-description"
                                    ></textarea>
                                </div>

                                <div className="form-div">
                                    <label htmlFor="uploader">Upload Resume</label>
                                    <FileUploader onFileSelect={handleFileSelect} />
                                </div>

                                <button className="primary-button" type="submit">
                                    Analyze Resume
                                </button>
                            </form>

                            {/* ✅ show preview if available */}
                            {previewUrl && (
                                <div className="mt-6">
                                    <h3 className="font-semibold">PDF Preview (Page 1):</h3>
                                    <img
                                        src={previewUrl}
                                        alt="PDF Preview"
                                        className="border rounded-md shadow-md mt-2 max-w-md"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </main>
    );
};

export default Upload;
