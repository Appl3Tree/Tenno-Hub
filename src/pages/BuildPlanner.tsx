import ModBuilder from "./tools/ModBuilder";
import { WorkspaceHero, WorkspaceStat } from "../components/workspace/WorkspaceChrome";
import { DAMAGE_RULESET } from "../domain/logic/damageRuleset";

export default function BuildPlanner() {
    return (
        <div className="space-y-4 px-1 md:px-2">
            <WorkspaceHero
                eyebrow="Planning Workspace"
                title="Build Planner"
                description="Configure weapon slots, compare assumptions, and inspect the damage model without leaving the planning workspace."
                stats={
                    <>
                        <WorkspaceStat label="Focus" value="Loadouts" hint="Work on build structure and slot choices in one place." />
                        <WorkspaceStat
                            label="Model"
                            value="Damage 3.0"
                            hint={`Rules reviewed ${DAMAGE_RULESET.lastVerified}; calculation and encounter-model limits are documented.`}
                        />
                        <WorkspaceStat
                            label="Output"
                            value="Compare + Explain"
                            hint="Make build tradeoffs readable instead of buried in raw numbers."
                            className="col-span-2 xl:col-span-1"
                        />
                    </>
                }
            />

            <ModBuilder />
        </div>
    );
}
