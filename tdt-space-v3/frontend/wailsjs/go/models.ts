export namespace buntdb {
	
	export class DB {
	
	
	    static createFrom(source: any = {}) {
	        return new DB(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace services {
	
	export class CleanupResult {
	    success: boolean;
	    cleaned: string[];
	
	    static createFrom(source: any = {}) {
	        return new CleanupResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.cleaned = source["cleaned"];
	    }
	}
	export class DialogOptions {
	    title?: string;
	    defaultPath?: string;
	    buttonLabel?: string;
	    properties?: string[];
	
	    static createFrom(source: any = {}) {
	        return new DialogOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.defaultPath = source["defaultPath"];
	        this.buttonLabel = source["buttonLabel"];
	        this.properties = source["properties"];
	    }
	}
	export class DialogResult {
	    canceled: boolean;
	    filePaths: string[];
	
	    static createFrom(source: any = {}) {
	        return new DialogResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.canceled = source["canceled"];
	        this.filePaths = source["filePaths"];
	    }
	}
	export class DirectoryEntry {
	    name: string;
	    path: string;
	    isDirectory: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DirectoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDirectory = source["isDirectory"];
	    }
	}
	export class DirectoryListing {
	    entries: DirectoryEntry[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DirectoryListing(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entries = this.convertValues(source["entries"], DirectoryEntry);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HistoryEntry {
	    command: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command = source["command"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class IMESettings {
	    enabled: boolean;
	    autoPatch: boolean;
	    patchedVersion?: string;
	
	    static createFrom(source: any = {}) {
	        return new IMESettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.autoPatch = source["autoPatch"];
	        this.patchedVersion = source["patchedVersion"];
	    }
	}
	export class KillClaudeProcessesResult {
	    Success: boolean;
	    Count: number;
	    Message: string;
	
	    static createFrom(source: any = {}) {
	        return new KillClaudeProcessesResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Success = source["Success"];
	        this.Count = source["Count"];
	        this.Message = source["Message"];
	    }
	}
	export class KillResult {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new KillResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class PatchResult {
	    success: boolean;
	    alreadyPatched?: boolean;
	    message?: string;
	    patchedPath?: string;
	    processesKilled?: number;
	    version?: string;
	
	    static createFrom(source: any = {}) {
	        return new PatchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.alreadyPatched = source["alreadyPatched"];
	        this.message = source["message"];
	        this.patchedPath = source["patchedPath"];
	        this.processesKilled = source["processesKilled"];
	        this.version = source["version"];
	    }
	}
	export class PatchStatus {
	    isPatched: boolean;
	    claudePath: string;
	    hasBackup: boolean;
	    installedVia: string;
	    version?: string;
	    claudeCodeInstalled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PatchStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isPatched = source["isPatched"];
	        this.claudePath = source["claudePath"];
	        this.hasBackup = source["hasBackup"];
	        this.installedVia = source["installedVia"];
	        this.version = source["version"];
	        this.claudeCodeInstalled = source["claudeCodeInstalled"];
	    }
	}
	export class PatchValidation {
	    isValid: boolean;
	    isPatched: boolean;
	    issues: string[];
	    suggestions: string[];
	
	    static createFrom(source: any = {}) {
	        return new PatchValidation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isValid = source["isValid"];
	        this.isPatched = source["isPatched"];
	        this.issues = source["issues"];
	        this.suggestions = source["suggestions"];
	    }
	}
	export class RestoreResult {
	    success: boolean;
	    message?: string;
	    backupPath?: string;
	
	    static createFrom(source: any = {}) {
	        return new RestoreResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.backupPath = source["backupPath"];
	    }
	}
	export class Result {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class SpawnAgentOptions {
	    id: string;
	    cwd?: string;
	    agentType: string;
	    command?: string;
	    args?: string[];
	    cols?: number;
	    rows?: number;
	    workspaceId?: string;
	
	    static createFrom(source: any = {}) {
	        return new SpawnAgentOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.cwd = source["cwd"];
	        this.agentType = source["agentType"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	        this.workspaceId = source["workspaceId"];
	    }
	}
	export class SpawnResult {
	    success: boolean;
	    pid?: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new SpawnResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.pid = source["pid"];
	        this.error = source["error"];
	    }
	}
	export class SpawnTerminalOptions {
	    id: string;
	    cwd?: string;
	    cols?: number;
	    rows?: number;
	    workspaceId?: string;
	
	    static createFrom(source: any = {}) {
	        return new SpawnTerminalOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.cwd = source["cwd"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	        this.workspaceId = source["workspaceId"];
	    }
	}
	export class StoreService {
	
	
	    static createFrom(source: any = {}) {
	        return new StoreService(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class TerminalPane {
	    id: string;
	    workspaceId: string;
	    agentType: string;
	    cwd: string;
	    title?: string;
	    status: string;
	    command?: string;
	    args?: string[];
	
	    static createFrom(source: any = {}) {
	        return new TerminalPane(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.workspaceId = source["workspaceId"];
	        this.agentType = source["agentType"];
	        this.cwd = source["cwd"];
	        this.title = source["title"];
	        this.status = source["status"];
	        this.command = source["command"];
	        this.args = source["args"];
	    }
	}
	export class WorkspaceLayout {
	    rows: number;
	    columns: number;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rows = source["rows"];
	        this.columns = source["columns"];
	    }
	}
	export class Template {
	    id: string;
	    name: string;
	    description?: string;
	    layout: WorkspaceLayout;
	    terminals: TerminalPane[];
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Template(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.layout = this.convertValues(source["layout"], WorkspaceLayout);
	        this.terminals = this.convertValues(source["terminals"], TerminalPane);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TerminalService {
	    Ctx: any;
	
	    static createFrom(source: any = {}) {
	        return new TerminalService(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ctx = source["Ctx"];
	    }
	}
	export class Workspace {
	    id: string;
	    name: string;
	    cwd: string;
	    layout: WorkspaceLayout;
	    terminals: TerminalPane[];
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Workspace(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.cwd = source["cwd"];
	        this.layout = this.convertValues(source["layout"], WorkspaceLayout);
	        this.terminals = this.convertValues(source["terminals"], TerminalPane);
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

