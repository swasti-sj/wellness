import React, { useMemo, useRef } from 'react';
import '../../styles/doctor/DoctorCertificate.css';
import { buildDocumentUrl, getDocumentName } from './documentHelpers';

function DocumentUpload({
  label,
  previewUrl,
  selectedFile,
  onFileChange,
  onRemove,
  uploading = false,
  isEditing = true,
  accept = '.pdf,image/*',
  emptyMessage = 'No document uploaded'
}) {
  const fileInputRef = useRef(null);

  const isPdf = useMemo(() => {
    if (selectedFile?.type === 'application/pdf') return true;
    return /\.pdf($|\?)/i.test(previewUrl || '');
  }, [previewUrl, selectedFile]);

  const resolvedUrl = previewUrl && !selectedFile ? buildDocumentUrl(previewUrl) : previewUrl;
  const displayName = selectedFile?.name || getDocumentName(previewUrl, 'View document');

  const handleContainerClick = () => {
    if (isEditing && fileInputRef.current && !uploading) {
      fileInputRef.current.click();
    }
  };

  const renderPreview = () => {
    if (!previewUrl) {
      return <div className="no-document-msg">{emptyMessage}</div>;
    }

    if (isPdf) {
      return (
        <div className="preview-container doc-file-preview">
          <div className="doc-file-icon">PDF</div>
          <div className="doc-file-meta">
            <div className="doc-file-name">{displayName}</div>
            {!selectedFile && (
              <a href={resolvedUrl} target="_blank" rel="noreferrer" className="doc-file-link">
                Open document
              </a>
            )}
          </div>
          {isEditing && onRemove && (
            <button type="button" className="remove-doc-btn" onClick={onRemove} title="Remove document">
              x
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="preview-container">
        <img src={resolvedUrl} alt={label} />
        {isEditing && onRemove && (
          <button type="button" className="remove-doc-btn" onClick={onRemove} title="Remove document">
            x
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="document-upload-section">
      <label className="upload-label">{label}</label>

      {isEditing ? (
        <>
          <div className="file-upload-container" onClick={handleContainerClick}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              accept={accept}
              className="file-input"
              disabled={uploading}
            />
            <div className="upload-instructions">
              <span>{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</span>
              <span className="file-types">PDF, PNG, JPG, JPEG</span>
            </div>
          </div>

          {previewUrl && (
            <div className="document-preview mt-2">
              <label>Preview</label>
              {renderPreview()}
            </div>
          )}
        </>
      ) : (
        <div className="document-preview view-only">{renderPreview()}</div>
      )}
    </div>
  );
}

export default DocumentUpload;
