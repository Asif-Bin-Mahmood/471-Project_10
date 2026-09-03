import { useEffect, useState } from "react";
import { uploadListingPhotos } from "../services/photoUpload.js";

export default function PhotoUploadField({
  listingType,
  initialUrls = [],
  label = "Photos",
  resetSignal = 0,
  onUploadingChange = () => {}
}) {
  const [urls, setUrls] = useState(() => Array.from(initialUrls || []));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrls(Array.from(initialUrls || []));
    setError("");
    setUploading(false);
    onUploadingChange(false);
  }, [resetSignal]);

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setUploading(true);
    onUploadingChange(true);
    setError("");
    try {
      const uploaded = await uploadListingPhotos(files, listingType, urls.length);
      setUrls((current) => [...current, ...uploaded.map((item) => item.url)]);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  }

  function removeUrl(url) {
    setUrls((current) => current.filter((item) => item !== url));
  }

  return (
    <div className="photo-upload-field">
      <div className="photo-upload-head">
        <span>{label}</span>
        <small>{urls.length}/6 uploaded</small>
      </div>

      <input type="hidden" name="photos" value={urls.join(",")} readOnly />
      <input
        className="photo-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFiles}
        disabled={uploading || urls.length >= 6}
      />
      <p className="editor-help">JPEG, PNG or WebP. Maximum 6 photos, 8 MB each.</p>

      {uploading ? <p className="photo-upload-status">Uploading photo securely...</p> : null}
      {error ? <p className="photo-upload-error">{error}</p> : null}

      {urls.length ? (
        <div className="photo-upload-list">
          {urls.map((url, index) => (
            <div className="photo-upload-item" key={url}>
              {/^https?:\/\//i.test(url) ? <img src={url} alt={`Photo ${index + 1}`} /> : <span className="photo-upload-placeholder">IMG</span>}
              <span>{`Photo ${index + 1}`}</span>
              <button type="button" onClick={() => removeUrl(url)} aria-label={`Remove photo ${index + 1}`}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
