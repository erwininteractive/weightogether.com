import prisma from "./database";
import { EntryVisibility, Prisma } from "@prisma/client";

/**
 * Centralized privacy logic for weight data.
 * Keeping this in one place prevents the "written-but-never-enforced"
 * class of bug that affected WeightEntry.visibility.
 */
export class PrivacyService {
	/**
	 * Returns true if `viewerId` and `ownerId` share at least one team.
	 * Used to evaluate TEAM-visibility entries.
	 */
	static async shareATeam(
		viewerId: string,
		ownerId: string,
	): Promise<boolean> {
		if (viewerId === ownerId) return true;
		const shared = await prisma.teamMember.findFirst({
			where: {
				userId: viewerId,
				team: { members: { some: { userId: ownerId } } },
			},
			select: { id: true },
		});
		return !!shared;
	}

	/**
	 * Build a Prisma `where` clause that returns only the weight entries of
	 * `ownerId` that `viewerId` is permitted to see.
	 *
	 *  - owner viewing self      -> all entries
	 *  - PUBLIC                  -> visible to everyone
	 *  - TEAM                    -> visible only if viewer shares a team with owner
	 *  - PRIVATE                 -> visible only to owner
	 */
	static async weightEntryVisibilityFilter(
		viewerId: string | null,
		ownerId: string,
	): Promise<Prisma.WeightEntryWhereInput> {
		// Owner sees everything they own.
		if (viewerId && viewerId === ownerId) {
			return { userId: ownerId };
		}

		const allowed: EntryVisibility[] = [EntryVisibility.PUBLIC];
		if (viewerId && (await this.shareATeam(viewerId, ownerId))) {
			allowed.push(EntryVisibility.TEAM);
		}

		return { userId: ownerId, visibility: { in: allowed } };
	}

	/**
	 * Whether `viewerId` may see a single already-loaded entry.
	 * Handy for guarding detail pages / API responses.
	 */
	static async canViewEntry(
		viewerId: string | null,
		entry: { userId: string; visibility: EntryVisibility },
	): Promise<boolean> {
		if (viewerId && viewerId === entry.userId) return true;
		if (entry.visibility === EntryVisibility.PUBLIC) return true;
		if (entry.visibility === EntryVisibility.TEAM && viewerId) {
			return this.shareATeam(viewerId, entry.userId);
		}
		return false;
	}
}
