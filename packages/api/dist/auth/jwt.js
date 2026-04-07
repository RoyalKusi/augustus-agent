import jwt from 'jsonwebtoken';
import { config } from '../config.js';
export function signToken(payload) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        return { businessId: decoded.businessId, email: decoded.email };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=jwt.js.map