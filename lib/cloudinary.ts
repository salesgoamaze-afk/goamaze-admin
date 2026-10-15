const CLOUD_NAME    = process.env.CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET!;

/**
 * Upload an image buffer to Cloudinary using an unsigned upload preset.
 * No API key or secret required — works with public upload presets.
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  mimeType: string,
  folder = "goamaze/products"
): Promise<{ url: string; publicId: string }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET in environment variables."
    );
  }

  // Convert buffer to base64 data URI
  const base64  = fileBuffer.toString("base64");
  const dataURI = `data:${mimeType};base64,${base64}`;

  const formData = new FormData();
  formData.append("file",           dataURI);
  formData.append("upload_preset",  UPLOAD_PRESET);
  formData.append("folder",         folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await res.json();
  return {
    url:      data.secure_url as string,
    publicId: data.public_id  as string,
  };
}

/**
 * Delete an image from Cloudinary by its public_id.
 *
 * NOTE: Unsigned delete is NOT supported by Cloudinary — this endpoint requires
 * an API key + secret.  We use the `destroy` REST endpoint with HTTP Basic auth
 * (api_key:api_secret encoded as base64).  If CLOUDINARY_API_KEY /
 * CLOUDINARY_API_SECRET are absent the function resolves silently so a missing
 * config never blocks a product deletion.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret || !CLOUD_NAME) {
    // Signed delete credentials not configured — skip cleanup gracefully.
    console.warn(
      "[cloudinary] deleteFromCloudinary: CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not set. " +
      "Skipping Cloudinary asset cleanup for publicId:", publicId
    );
    return;
  }

  // Build a Unix timestamp for the signature
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // The string to sign: "public_id=…&timestamp=…" + api_secret (Cloudinary v1 signature)
  const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;

  // SHA-1 via Web Crypto (works in Node ≥ 15 / Edge runtime)
  const msgBuffer  = new TextEncoder().encode(strToSign);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const signature  = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp,
    api_key:   apiKey,
    signature,
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[cloudinary] deleteFromCloudinary failed:", text);
    // Non-fatal — don't throw; let the product deletion continue.
  }
}

/** Public helper to get the cloud name for client-side references */
export const cloudName    = CLOUD_NAME;
export const uploadPreset = UPLOAD_PRESET;
