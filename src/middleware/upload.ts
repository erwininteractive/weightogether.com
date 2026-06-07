import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../public/uploads");
const progressPhotosDir = path.join(uploadsDir, "progress");
const avatarsDir = path.join(uploadsDir, "avatars");

if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(progressPhotosDir)) {
	fs.mkdirSync(progressPhotosDir, { recursive: true });
}

if (!fs.existsSync(avatarsDir)) {
	fs.mkdirSync(avatarsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, progressPhotosDir);
	},
	filename: (_req, file, cb) => {
		// Generate unique filename with timestamp and random string
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, `progress-${uniqueSuffix}${ext}`);
	},
});

// File filter - only allow images
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
	const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

	if (allowedMimes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				"Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
			),
		);
	}
};

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, avatarsDir);
	},
	filename: (_req, file, cb) => {
		// Generate unique filename with timestamp and random string
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, `avatar-${uniqueSuffix}${ext}`);
	},
});

// Export configured multer instances
export const uploadProgress = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB max
		files: 3, // Max 3 files per upload
	},
});

export const uploadAvatar = multer({
	storage: avatarStorage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max for avatars
		files: 1, // Only 1 file
	},
});
