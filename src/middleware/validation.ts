import { body, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validateProcessMessage = [
  body('message')
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be a string between 1 and 1000 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('context.userLocation')
    .optional()
    .isString()
    .withMessage('User location must be a string'),
];

export const validateExecuteTool = [
  param('toolName')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Tool name must be a string between 1 and 100 characters'),
  body('args')
    .isObject()
    .withMessage('Arguments must be an object'),
  body('authToken')
    .optional()
    .isString()
    .withMessage('Auth token must be a string'),
  body('userId')
    .optional()
    .isString()
    .withMessage('User ID must be a string'),
];

export const validateSearchBusinesses = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a number between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a number between -180 and 180'),
  body('radius')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Radius must be an integer between 1 and 50'),
  body('keyword')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Keyword must be a string with max 100 characters'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request parameters',
      details: errors.array(),
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }
  next();
};
