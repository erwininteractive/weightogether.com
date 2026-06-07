// Override passport's User type to be compatible with our JwtPayload
import { JwtPayload } from "./auth";

declare global {
	namespace Express {
		// Make User match JwtPayload so we don't get type conflicts
		interface User extends JwtPayload {}
	}
}

export {};
