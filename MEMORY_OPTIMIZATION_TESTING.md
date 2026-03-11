# Memory Optimization - Testing Guide

## Các Optimization Đã Implement

### Phase 1: Go Backend Optimization ✅
1. **GC Tuning** (`main.go`)
   - `debug.SetGCPercent(20)` - GC chạy aggressive hơn (default: 100)
   - `debug.SetMemoryLimit(512MB)` - Giới hạn memory lúc startup
   - `runtime.GOMAXPROCS(runtime.NumCPU())` - Tối ưu goroutine threads

2. **Terminal Batching Buffer** (`internal/services/terminal_batching.go`)
   - Giảm `batchMaxSize` từ 8192 → 4096 bytes
   - Giảm `maxBufferedDataSize` từ 1MB → 512KB

### Phase 2: Frontend Optimization ✅
3. **Scrollback Buffer** (`src/components/terminals/TerminalCell.tsx`)
   - Giảm `scrollback` từ 1000 → 500 lines

4. **Lazy WebGL Loading** (`src/components/terminals/TerminalCell.tsx`)
   - WebGL addon chỉ load khi terminal trở nên active
   - Giảm 50-100MB per terminal lúc startup

5. **Staggered Terminal Spawn** (`src/components/workspaces/WorkspaceCreationModal.tsx`)
   - Thêm 150ms delay giữa mỗi terminal spawn
   - Prevent memory alloc burst khi tạo nhiều terminals

6. **Vite Bundle Optimization** (`vite.config.ts`)
   - Code splitting với manualChunks
   - Terser compression với drop_console/drop_debugger
   - Target esnext cho modern browsers

### Phase 3: Build Optimization ✅
7. **Go Build Flags** (`build.bat`)
   - Thêm `-ldflags="-s -w"` để strip debug symbols
   - Giảm binary size và memory footprint

8. **Memory Monitoring** (`src/App.tsx`)
   - Enable MemoryMonitor với 10s interval
   - Log memory stats sau 5s startup

---

## Hướng Dẫn Test

### Bước 1: Build Production
```bash
# Windows
build.bat prod

# Hoặc build thủ công với flags tối ưu
wails build -clean -trimpath -upx -ldflags="-s -w"
```

### Bước 2: Chạy App và Theo Dõi Memory

1. **Mở Task Manager** (Ctrl+Shift+Esc)
2. **Tìm "TDT Space"** trong Processes tab
3. **Memory column** - click để sort by memory

### Bước 3: Test Scenarios

#### Scenario A: Cold Start (No workspace)
1. Close app hoàn toàn
2. Open app từ build/release
3. **Theo dõi memory peak trong 60s đầu**
4. Ghi nhận:
   - Peak memory (MB)
   - Time to stabilize (s)
   - Stable memory (MB)

#### Scenario B: Create Workspace với 5-8 terminals
1. Click "Create Workspace"
2. Chọn template với 5-8 terminals
3. **Theo dõi memory spike khi terminals spawn**
4. Ghi nhận:
   - Memory trước khi create
   - Peak memory trong khi spawn
   - Time to stabilize
   - Stable memory

#### Scenario C: Multiple Workspaces
1. Tạo 2-3 workspaces với 4-6 terminals mỗi cái
2. Switch giữa các workspaces
3. **Theo dõi memory khi switch**
4. Ghi nhận memory tăng thêm mỗi workspace

### Bước 4: Verify Memory Monitoring

Mở console logs (nếu có thể) hoặc check browser DevTools:

```javascript
// Trong console, check memory stats
console.log(MemoryMonitor.getStats());
console.log(MemoryMonitor.getLeakReport());
```

---

## Expected Results

### Trước Optimization (Baseline)
| Scenario | Peak Memory | Time to Stabilize | Stable Memory |
|----------|-------------|-------------------|---------------|
| Cold Start | 2-3 GB | 60-90s | 50-100 MB |
| 5-8 Terminals | +1-2 GB | 30-60s | +200-400 MB |
| Each Workspace | +500MB | 10-20s | +100-200 MB |

### Sau Optimization (Target)
| Scenario | Peak Memory | Time to Stabilize | Stable Memory |
|----------|-------------|-------------------|---------------|
| Cold Start | **800MB-1.5GB** (-50%) | 30-60s (-33%) | 30-60 MB (-40%) |
| 5-8 Terminals | **+500MB-1GB** (-50%) | 15-30s (-50%) | +100-200 MB (-50%) |
| Each Workspace | **+250MB** (-50%) | 5-10s (-50%) | +50-100 MB (-50%) |

---

## Checklist Verification

- [ ] App khởi động thành công không crash
- [ ] 5-8 terminals spawn thành công
- [ ] WebGL加载 khi click vào terminal (check console log)
- [ ] Memory monitoring logs xuất hiện trong console
- [ ] Không có memory leak sau 5 phút sử dụng
- [ ] Terminal output vẫn smooth, không giật lag
- [ ] Resize terminal vẫn hoạt động tốt

---

## Troubleshooting

### Nếu memory vẫn cao:
1. **Check Go GC logs**:
   ```bash
   set GODEBUG=gctrace=1
   TDT.Space.exe
   ```
   → Xem GC frequency và duration

2. **Check frontend memory**:
   - Mở DevTools → Performance tab
   - Record memory timeline
   - Check heap snapshots

3. **Disable WebGL** (nếu vẫn gặp issues):
   ```typescript
   // Trong TerminalCell.tsx, comment out WebGL loading
   // const shouldLoadWebGL = isActive;
   const shouldLoadWebGL = false; // Force disable
   ```

### Nếu terminals spawn chậm:
- Giảm delay từ 150ms → 100ms hoặc 50ms
- Balance giữa memory spike và UX

---

## Reporting

Sau khi test, report kết quả:

```
Test Date: [Date]
Build: [Commit hash/Version]

Scenario A - Cold Start:
- Peak Memory: [X] MB
- Time to Stabilize: [X]s
- Stable Memory: [X] MB

Scenario B - 5-8 Terminals:
- Memory Before: [X] MB
- Peak Memory: [X] MB
- Time to Stabilize: [X]s
- Stable Memory: [X] MB

Scenario C - Multiple Workspaces:
- Memory per Workspace: [X] MB

Issues Found:
- [List any issues or anomalies]

Recommendations:
- [Suggestions for further optimization]
```
