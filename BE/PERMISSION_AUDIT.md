# Backend Permission Audit

Last updated: 2026-08-17

## Permission Model

System role:
- `ADMIN`: system/company admin. External admins are scoped to their company unless `externalRole = sadmin`.
- `MANAGER`: business manager, scoped by company/department or explicit project/document assignment.
- `EMPLOYEE`: must be explicitly assigned to project or document.

Project/document roles:
- `VIEWER`: read.
- `REVIEWER`: read and comment/review.
- `EDITOR`: edit content/work artifacts.
- `MANAGER`: manage, delete, and share access.

Multi-role fields `roles[]` are authoritative when present; legacy `role` is fallback.

## Current Access Rules

Projects:
- List/detail uses `projectVisibilityWhere`.
- Update/delete require project `MANAGER`.
- Project member list now requires project-level `VIEWER`; direct document permission alone must not expose all project members.

Documents:
- Read/version/export require document `VIEWER`.
- Create requires project `EDITOR` or `MANAGER`.
- Update/restore/tag write require document `EDITOR` or `MANAGER`.
- Delete/share require document `MANAGER`.

Comments:
- Read requires document `VIEWER`.
- Create/resolve requires document `REVIEWER` or above.
- Update/delete requires document `REVIEWER` or above and comment ownership.
- A comment with replies from another user cannot be deleted by its owner.

Workboard:
- Read project board requires project `VIEWER`; document-only users see only work items linked to documents they can view.
- Create requires document/project `REVIEWER` or above.
- Any permitted teammate may change only ticket status.
- Only ticket owner may edit ticket content, delete ticket, or upload attachments.
- Work item comments/replies require work item `REVIEWER` or above.
- Only comment/reply owner may edit/delete their own comment/reply.
- Multiple assignees must be active members of the same project.
- Checklist, labels, dependencies, attachments, title, priority, due date, and assignee changes are content edits and therefore owner-only.
- Dependencies must point to tickets in the same project.

Users/share:
- User management is admin/manager-only.
- Project share requires project `MANAGER`.
- Document share requires document `MANAGER`.

## Tests Added

Run:

```bash
npm run test:permission
```

Covered:
- `PermissionsService`: role hierarchy, `roles[]`, document direct access, project denial, external admin company scope, `sadmin` bypass.
- `ProjectsService`: project member list requires project-level permission and hides inactive users.
- `WorkItemsService`: non-owner can status-drag only, cannot edit content/comment, unpermitted user cannot status-drag, owner cannot delete a comment with another user's reply.

## Workboard Foundation Added

- `WorkItemAssignee`: normalized multiple assignee table.
- `WorkItemChecklistItem`: subtask/checklist foundation.
- `WorkItemLabel` and `WorkItemLabelLink`: project-scoped ticket labels.
- `WorkItemDependency`: dependency graph foundation for blocked-by relationships.
- Work item update audit metadata now contains field-level `changes`.
- Assignment writes create `WorkItem` notifications for newly assigned users.

## Known Follow-Ups

- Add controller/e2e tests around JWT-protected routes once a test database seed is available.
- Add tests for `UsersService` share-candidate and assignment batch paths.
- Add dedicated UI for dependency management, calendar/timeline, workload-by-person board, and mention autocomplete.
