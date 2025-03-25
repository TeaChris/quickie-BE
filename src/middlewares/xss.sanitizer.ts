// src/middleware/xssSanitizer.ts
import { Request, Response, NextFunction } from 'express';
import { FilterXSS, IWhiteList } from 'xss';

// Configure allowed HTML (empty for maximum security)
const XSS_WHITELIST: IWhiteList = {
    a: ['href', 'title', 'target'],
    br: [],
    span: ['class'],
    div: ['class'],
    // Allow absolutely nothing for flash sale APIs
};

const xssFilter = new FilterXSS({
    whiteList: XSS_WHITELIST,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'],
    css: false, // Disable CSS filtering if not needed
    onTagAttr: (tag, name, value) => {
        // Allow only specific URL protocols
        if (name === 'href' || name === 'src') {
            if (/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(value)) {
                return `${name}="${value}"`;
            }
            return '';
        }
    }
});

const deepXSSClean = (obj: any): any => {
    if (typeof obj === 'string') {
        return xssFilter.process(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepXSSClean(item));
    }

    if (obj && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc: { [key: string]: any }, key) => {
            acc[key] = deepXSSClean(obj[key]);
            return acc;
        }, {});
    }

    return obj;
};

export const xssClean = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Sanitize all input sources
            if (req.body) req.body = deepXSSClean(req.body);
            if (req.query) req.query = deepXSSClean(req.query);
            if (req.params) req.params = deepXSSClean(req.params);
            if (req.headers) {
                // Special handling for headers
                const sanitizedHeaders = deepXSSClean(req.headers);
                Object.entries(sanitizedHeaders).forEach(([key, value]) => {
                    req.headers[key] = Array.isArray(value)
                        ? value.map(String)
                        : String(value);
                });
            }

            // Set security headers
            res.header({
                'X-XSS-Protection': '1; mode=block',
                'Content-Security-Policy': 'default-src \'self\''
            });

            next();
        } catch (error) {
            console.error('XSS Sanitization Error:', error);
            res.status(400).json({
                error: 'Invalid request content detected',
                code: 'XSS_VALIDATION_FAILED'
            });
        }
    };
};