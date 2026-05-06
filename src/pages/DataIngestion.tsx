import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { uploadMppFile } from '../api/dataIngestionApi'

export default function DataIngestion() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const setMppFile = async (file?: File) => {
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.mpp')) {
      setFileName('')
      setError('Upload a Microsoft Project .mpp file.')
      return
    }

    setError('')
    setFileName('')
    setIsUploading(true)
    try {
      const result = await uploadMppFile(file)
      setFileName(result.fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload MPP file.')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void setMppFile(event.target.files?.[0])
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    void setMppFile(event.dataTransfer.files[0])
  }

  return (
    <div className="px-8 py-8 min-h-full">
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 flex items-center justify-center transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Data Ingestion</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload Microsoft Project schedules for future consolidation workflows.
          </p>
        </div>
      </div>

      <section className="max-w-3xl bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4 mb-6">
          <span className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Microsoft Project upload</h2>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
              Upload Microsoft MPP files whose names match a Work Package in the plan rows.
            </p>
          </div>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-200 rounded-xl px-6 py-12 flex flex-col items-center text-center bg-gray-50"
        >
          <span className="w-14 h-14 rounded-xl bg-white border border-gray-200 text-emerald-600 flex items-center justify-center mb-4">
            <UploadCloud size={26} />
          </span>
          <h3 className="text-base font-bold text-gray-900">Drop an .mpp file here</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md">
            Select or drag a Microsoft Project MPP file. The file name must match a Work Package.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="mt-5 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {isUploading ? 'Uploading...' : 'Choose MPP file'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".mpp,application/vnd.ms-project"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {fileName && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="font-medium">{fileName}</span>
            <span className="text-emerald-700">uploaded for conversion</span>
          </div>
        )}
      </section>
    </div>
  )
}
