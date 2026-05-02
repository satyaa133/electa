import { body, validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map((err) => ({
        field: err.type === "field" ? err.path : "unknown",
        message: err.msg,
      })),
    });
  }
  next();
};

export const signupValidators: ValidationChain[] = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 }) // Using 6 for now to avoid breaking existing users, ideally 12
    .withMessage("Password must be at least 6 characters"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("Name contains invalid characters"),
];

export const loginValidators: ValidationChain[] = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("password").isLength({ min: 1 }).withMessage("Password is required"),
];

export const userUpdateValidators: ValidationChain[] = [
  body("bio")
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage("Bio must not exceed 500 characters"),
  body("profile_photo")
    .optional({ checkFalsy: true })
    // Basic check for base64 or url
    .isString()
    .withMessage("Profile photo must be a string"),
  body("location")
    .optional({ checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage("Location must not exceed 100 characters"),
  body("preferences")
    .optional()
    .isObject()
    .withMessage("Preferences must be an object"),
];
