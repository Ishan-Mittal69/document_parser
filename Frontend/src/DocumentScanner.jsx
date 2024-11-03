import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DocumentScanner = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a document image first');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch('http://localhost:5000/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const data = await response.json();
      // console.log(data);
      setResult(data);
      // console.log("result: ", result);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Document Information Extractor</h1>
          <p className="text-gray-600">Upload a passport or driver's license image</p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center space-y-2"
          >
            <Upload className="h-8 w-8 text-gray-400" />
            <span className="text-sm text-gray-600">
              {file ? file.name : 'Click to upload or drag and drop'}
            </span>
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !file}
          className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Extract Information'}
        </button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="border rounded-lg p-4 space-y-2">
            <h2 className="font-semibold text-lg">Extracted Information</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-gray-600">Name:</div>
              <div>{result.Name}</div>
              <div className="text-gray-600">Document Number:</div>
              <div>{result.documentNumber}</div>
              <div className="text-gray-600">Expiration Date:</div>
              <div>{result.expirationDate}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentScanner;