import ExportImport from "../components/ExportImport";
import AlecaFrameImport from "../components/AlecaFrameImport";
import { WorkspaceHero, WorkspaceStat } from "../components/workspace/WorkspaceChrome";

export default function Imports() {
    return (
        <div className="flex flex-col gap-4">
            <WorkspaceHero
                eyebrow="System Workspace"
                title="Imports & Backups"
                description="Move profile data in and out safely, verify what will change, and keep a recoverable backup before major updates."
                stats={
                    <WorkspaceStat
                        label="Safety"
                        value="Review first"
                        hint="Imports should feel transparent, reversible, and easy to validate."
                    />
                }
            />
            <AlecaFrameImport />
            <ExportImport />
        </div>
    );
}
