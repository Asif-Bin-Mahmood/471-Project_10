import { uploadListingPhoto } from "../services/listingPhotoStorage.service.js";

const ROLE_BY_LISTING_TYPE = {
  property: "property-owner",
  service: "service-provider"
};

function decodedFileName(headerValue) {
  if (!headerValue) return "photo";
  try {
    return decodeURIComponent(headerValue);
  } catch {
    return String(headerValue);
  }
}

export async function uploadPhoto(req, res, next) {
  try {
    const listingType = String(req.get("x-listing-type") || "").trim();
    const requiredRole = ROLE_BY_LISTING_TYPE[listingType];

    if (!requiredRole) {
      return res.status(422).json({ error: "Listing type must be property or service." });
    }

    if (req.user.role !== "admin" && req.user.role !== requiredRole) {
      return res.status(403).json({
        error: `Only ${requiredRole} accounts can upload ${listingType} photos.`
      });
    }

    if (req.user.role !== "admin" && req.user.verificationStatus !== "verified") {
      return res.status(403).json({ error: "A verified account is required to upload listing photos." });
    }

    const photo = await uploadListingPhoto({
      buffer: req.body,
      contentType: String(req.get("content-type") || "").split(";")[0].trim().toLowerCase(),
      originalName: decodedFileName(req.get("x-file-name")),
      ownerId: req.user._id,
      listingType
    });

    res.status(201).json({ photo });
  } catch (error) {
    next(error);
  }
}
