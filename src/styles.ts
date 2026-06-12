export const styles = `
* { box-sizing: border-box; }
body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
html, body, #root { max-width: 100%; overflow-x: hidden; }
.app-shell { min-height: 100vh; display: flex; background: #f8fafc; }
.main-panel { flex: 1; min-width: 0; overflow-x: clip; margin-left: 260px; }
.netcomply-page-wrapper { width: 100%; min-width: 0; isolation: isolate; }
.side-menu { width: 260px; background: #ffffff; border-right: 1px solid #e5e7eb; padding: 24px 18px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; height: 100vh; z-index: 30; }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 34px; }
.brand-mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; background: #0b63f6; color: #fff; font-weight: 900; }
.brand-name { font-weight: 800; font-size: 20px; }
.brand-subtitle { color: #64748b; font-size: 12px; margin-top: 2px; }
.menu-group-label { font-size: 11px; color: #94a3b8; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 8px; }
.menu-list { display: grid; gap: 8px; }
.menu-item { border: 0; background: transparent; color: #334155; font: inherit; font-weight: 650; padding: 13px 14px; display: flex; align-items: center; gap: 12px; border-radius: 12px; cursor: pointer; text-align: left; }
.menu-item:hover { background: #f1f5f9; }
.menu-item.active { background: #eaf2ff; color: #0b63f6; }
.menu-footer { margin-top: auto; color: #475569; display: flex; gap: 12px; align-items: center; font-weight: 600; padding: 14px; }
.top-bar { height: 76px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; gap: 24px; position: sticky; top: 0; z-index: 5; }
.top-search { width: min(620px, 44vw); }
.top-search input, .grow-input input { width: 100%; }
.p-input-icon-left { position: relative; display: inline-flex; align-items: center; min-width: 0; }
.p-input-icon-left > i { position: absolute; left: 0.85rem; z-index: 1; color: #64748b; pointer-events: none; }
.p-input-icon-left > .p-inputtext { padding-left: 2.35rem; }
.top-actions { display: flex; align-items: center; gap: 18px; }
.scan-clock { display: flex; align-items: center; gap: 10px; color: #334155; }
.scan-clock i { color: #64748b; }
.scan-clock strong { display: block; font-size: 13px; }
.scan-clock span { color: #64748b; font-size: 12px; }
.role-dropdown { width: 190px; }
.page-content { padding: 26px 32px 40px; }
.page-content, .table-card, .wizard-card, .editor-card, .device-detail-card, .finding-detail-card { max-width: 100%; }
.page-header { margin-bottom: 22px; }
.breadcrumb { font-size: 13px; color: #64748b; margin-bottom: 12px; }
.page-header h1 { margin: 0; font-size: 30px; letter-spacing: -0.04em; }
.page-header p { color: #475569; margin: 8px 0 0; }
.plain-page-title { margin-bottom: 22px; }
.plain-page-title h1 { margin: 0; font-size: 30px; letter-spacing: -0.04em; }
.filter-card { display: flex; gap: 16px; align-items: center; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04); padding: 16px; border-radius: 14px; margin-bottom: 18px; }
.grow-input { flex: 1; min-width: 260px; }
.table-card, .wizard-card, .editor-card, .device-detail-card, .finding-detail-card { border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04); }
.table-card .p-datatable-wrapper { overflow-x: auto; max-width: 100%; }
.table-card .p-datatable-table { width: 100%; table-layout: auto; }
.table-card .p-datatable .p-datatable-tbody > tr > td { vertical-align: top; }
.action-row { display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; }
.action-row .p-button { white-space: nowrap; flex: 0 0 auto; }
.status-cell { display: flex; justify-content: center; align-items: center; width: 100%; }
.status-pill { min-width: 132px; justify-content: center; text-align: center; font-weight: 800; }
.partial-complete-status { background: #dcfce7 !important; color: #166534 !important; border: 1px solid #86efac !important; }
.p-button { min-width: 0; }
.p-button .p-button-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.link-button { border: 0; background: transparent; color: #0b63f6; font-weight: 800; cursor: pointer; font-size: 15px; }
.user-cell, .device-cell, .window-cell { display: flex; align-items: center; gap: 12px; }
.user-cell strong, .device-cell strong { display: block; }
.user-cell span, .device-cell span, .window-cell span { display: block; color: #64748b; font-size: 13px; margin-top: 3px; }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: #1e293b; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 800; }
.device-icon { width: 34px; height: 34px; border-radius: 10px; background: #eff6ff; color: #0b63f6; display: grid; place-items: center; }
.wizard-card .p-card-body { padding: 28px; }
.ticket-stepper { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.ticket-stepper-item { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; color: #64748b; }
.ticket-stepper-item span { width: 28px; height: 28px; flex: 0 0 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #e2e8f0; color: #475569; font-weight: 900; font-size: 13px; }
.ticket-stepper-item strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 900; }
.ticket-stepper-item.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
.ticket-stepper-item.active span { background: #2563eb; color: #ffffff; }
.ticket-stepper-item.complete { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
.ticket-stepper-item.complete span { background: #22c55e; color: #ffffff; }
.step-content { margin-top: 30px; min-height: 430px; }
.wizard-footer { border-top: 1px solid #e5e7eb; padding-top: 20px; display: flex; justify-content: space-between; }
.scope-grid, .step-stack { display: grid; gap: 18px; }
.full-span { grid-column: 1 / -1; }
.field-block { display: grid; gap: 8px; }
.field-block label { font-weight: 750; color: #334155; }
.field-block .p-autocomplete, .field-block .p-autocomplete-input, .field-block .p-autocomplete-multiple-container { width: 100%; }
.field-block .p-autocomplete-multiple-container { min-height: 42px; align-items: center; }
.policy-setting-dropdown { width: 100%; min-width: 0; }
.policy-setting-dropdown .p-dropdown-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.policy-setting-dropdown-panel { width: min(680px, calc(100vw - 32px)); max-width: calc(100vw - 32px); }
.policy-setting-dropdown-panel .p-dropdown-item { white-space: normal; line-height: 1.4; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 16px; }
.summary-card, .review-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; }
.summary-card h3, .review-card h3 { margin: 0 0 12px; }
.section-subtitle, .empty-text, .muted-note { color: #64748b; }
.implementation-banner { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
.implementation-banner p { margin: 0; line-height: 1.5; font-weight: 650; }
.device-list-mini { display: grid; gap: 10px; }
.device-mini-card { display: flex; align-items: center; gap: 14px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
.device-mini-card i { color: #0b63f6; font-size: 22px; }
.device-mini-card strong { display: block; }
.device-mini-card span { color: #64748b; font-size: 13px; }
.finding-group { margin-top: 14px; }
.finding-group-title { font-weight: 800; color: #334155; margin-bottom: 8px; }
.finding-list-table { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #fff; }
.finding-list-header, .finding-list-row { display: grid; grid-template-columns: 40px minmax(240px, 0.9fr) minmax(360px, 1.4fr); gap: 14px; align-items: start; }
.finding-list-header { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; padding: 11px 14px; border-bottom: 1px solid #e5e7eb; }
.finding-list-row { padding: 14px; border-bottom: 1px solid #eef2f7; }
.finding-list-row:last-child { border-bottom: 0; }
.finding-list-row-disabled { background: #f8fafc; opacity: 0.82; }
.finding-rule-cell, .finding-standard-cell { min-width: 0; display: grid; gap: 6px; }
.finding-rule-cell strong { color: #0f172a; line-height: 1.35; }
.finding-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.finding-title-row h3, .finding-title-row strong { margin: 0; min-width: 0; }
.finding-rule-cell small, .finding-standard-cell small { color: #64748b; line-height: 1.45; overflow-wrap: anywhere; }
.payload-config-text { color: #0f172a; font-size: 14px; font-weight: 800; line-height: 1.45; overflow-wrap: anywhere; }
.config-download-button { width: fit-content; }
.config-download-empty { color: #64748b; font-weight: 700; }
.device-snapshot-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 14px; margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; }
.device-snapshot-row span { color: #475569; font-size: 13px; font-weight: 850; }
.device-reversion-warning { display: flex; align-items: flex-start; gap: 12px; margin-top: 12px; padding: 12px 14px; border: 1px solid #fbbf24; border-left: 4px solid #d97706; border-radius: 8px; background: #fffbeb; color: #78350f; }
.device-reversion-warning i { margin-top: 2px; color: #d97706; }
.device-reversion-warning strong { display: block; }
.device-reversion-warning p { margin: 4px 0 0; color: #92400e; line-height: 1.45; }
.finding-result-note { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #f0fdf4; color: #166534; font-weight: 700; }
.finding-result-note.failed { background: #fef2f2; color: #991b1b; }
.fix-availability-cell, .template-availability-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.fix-availability-cell { display: grid; justify-items: start; }
.template-availability-row { margin-top: 8px; }
.template-availability-note { display: block; color: #64748b; line-height: 1.45; font-weight: 650; }
.template-disabled-note { display: inline-flex; align-items: center; gap: 7px; width: fit-content; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 800; }
.mobile-field-label { display: none; color: #64748b; font-size: 11px; font-weight: 850; text-transform: uppercase; }
.empty-row { padding: 16px; background: #f8fafc; border-radius: 10px; color: #64748b; }
.nested-card { margin-bottom: 16px; border: 1px solid #e5e7eb; box-shadow: none; background: #fff; border-radius: 14px; overflow: hidden; }
.card-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.card-title-row h3 { margin: 0; }
.card-title-row p { color: #64748b; margin: 4px 0 0; }
.collapsible-header { width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.device-collapse-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
.device-collapse-header h3 { margin: 0; }
.device-collapse-header p { color: #64748b; margin: 4px 0 0; }
.collapse-meta { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.collapse-meta i { color: #475569; font-size: 13px; }
.device-fix-stack { display: grid; gap: 14px; padding: 14px; }
.review-remediation-stack { display: grid; gap: 12px; margin-top: 14px; }
.review-remediation-stack .nested-card { margin-bottom: 0; }
.review-scope-remediation { border-top: 1px solid #e5e7eb; margin-top: 16px; padding-top: 16px; }
.review-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.command-block { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-top: 0; }
.command-header { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 12px 14px; background: #f8fafc; }
.command-header strong { display: block; }
.command-header span { color: #64748b; font-size: 13px; }
.review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.template-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(480px, 0.9fr); gap: 18px; align-items: start; }
.template-table-toolbar { padding: 14px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: flex-end; }
.template-editor-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.command-editor { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.structured-editor-section { border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #fff; }
.structured-section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 14px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
.structured-section-header.compact { padding: 0; background: transparent; border-bottom: 0; align-items: center; }
.structured-section-header label { font-weight: 850; color: #334155; }
.structured-section-header p { margin: 5px 0 0; color: #64748b; line-height: 1.45; font-size: 13px; max-width: 820px; }
.validation-script-editor-list { display: grid; gap: 12px; padding: 14px; }
.validation-script-editor { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; display: grid; gap: 14px; background: #fcfcfd; }
.script-editor-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
.command-row-editor { display: grid; gap: 10px; }
.command-edit-row-list { display: grid; gap: 8px; }
.command-edit-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 10px; align-items: center; }
.command-edit-row > span { width: 28px; height: 28px; border-radius: 999px; background: #eef6ff; color: #0b63f6; display: grid; place-items: center; font-size: 12px; font-weight: 900; }
.command-edit-row .p-inputtext { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.dialog-stack { display: grid; gap: 14px; }
.dialog-summary { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.device-option-template { display: grid; gap: 8px; padding: 4px 0; }
.device-option-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.device-option-top strong { display: block; }
.device-option-top span { display: block; color: #64748b; font-size: 12px; margin-top: 3px; }
.device-option-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.bulk-selection-info { font-weight: 700; color: #334155; }

.detail-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.detail-actions { display: flex; align-items: center; gap: 10px; padding-top: 4px; }
.device-detail-card, .finding-detail-card { margin-bottom: 18px; }
.device-detail-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.device-info-split { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e5e7eb; }
.device-info-column { display: grid; align-content: start; padding: 4px 0; }
.device-info-column + .device-info-column { border-left: 1px solid #e5e7eb; padding-left: 18px; margin-left: 18px; }
.meta-tile { display: grid; grid-template-columns: minmax(120px, 0.42fr) minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 12px 0; border-bottom: 1px solid #eef2f7; }
.meta-tile:last-child { border-bottom: 0; }
.meta-tile span { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.meta-tile strong { color: #0f172a; font-size: 14px; font-weight: 750; text-align: right; overflow-wrap: anywhere; }
.ticket-result-summary { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
.finding-detail-list { display: grid; gap: 18px; }
.finding-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.finding-detail-header h3 { margin: 0; }
.finding-detail-header p { margin: 5px 0 0; color: #64748b; }
.finding-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.noncompliance-box { border-radius: 14px; padding: 14px; border: 1px solid; }
.noncompliance-box span, .reason-box span { display: block; font-size: 12px; font-weight: 800; color: #64748b; margin-bottom: 7px; }
.noncompliance-box strong { display: block; line-height: 1.45; }
.danger-box { background: #fff7f7; border-color: #fecaca; }
.success-box { background: #f0fdf4; border-color: #bbf7d0; }
.reason-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-bottom: 14px; }
.reason-box p { margin: 0; color: #334155; line-height: 1.55; }
.template-editor-stack { display: grid; gap: 18px; margin-bottom: 18px; }
.guardrail-box { background: #fff7ed; border: 1px solid #fed7aa; color: #7c2d12; border-radius: 14px; padding: 14px; }
.guardrail-box p { margin: 6px 0 0; line-height: 1.55; }
.agreed-setting-box { display: grid; gap: 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-bottom: 16px; }
.agreed-setting-box strong { color: #334155; }
.agreed-setting-box pre { margin: 0; white-space: pre-wrap; word-break: break-word; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.5; }
.inline-policy-model { margin-top: 10px; margin-bottom: 0; }
.execution-preview { display: grid; gap: 12px; margin-top: 14px; }
.policy-model-block { display: grid; gap: 10px; border: 1px solid #c7d2fe; border-left: 6px solid #4f46e5; border-radius: 12px; background: #eef2ff; padding: 12px 14px; }
.policy-model-block span { display: block; color: #475569; font-size: 12px; font-weight: 850; text-transform: uppercase; }
.policy-model-block strong { display: block; color: #1e1b4b; margin-top: 3px; }
.policy-model-block pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #1e293b; line-height: 1.5; }
.execution-section { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #ffffff; }
.phase-section { border-left-width: 6px; }
.phase-pre { border-color: #bfdbfe; border-left-color: #2563eb; }
.phase-fix { border-color: #fde68a; border-left-color: #d97706; }
.phase-post { border-color: #bbf7d0; border-left-color: #16a34a; }
.execution-section-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; background: #f8fafc; }
.phase-pre .execution-section-header { background: #eff6ff; color: #1d4ed8; }
.phase-fix .execution-section-header { background: #fffbeb; color: #92400e; }
.phase-post .execution-section-header { background: #f0fdf4; color: #166534; }
.script-check-list { display: grid; gap: 12px; padding: 12px; border-top: 1px solid #e5e7eb; }
.script-check-block { border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; overflow: hidden; }
.script-check-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 12px 14px; border-bottom: 1px solid #eef2f7; background: #fbfdff; }
.script-check-head strong { display: block; color: #0f172a; margin-top: 3px; }
.script-check-index { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.script-check-columns { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 0; }
.numbered-line-panel { min-width: 0; padding: 12px 14px; }
.numbered-line-panel + .numbered-line-panel { border-left: 1px solid #eef2f7; }
.numbered-line-title { color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; margin-bottom: 8px; }
.numbered-line-list { display: grid; gap: 7px; }
.numbered-line { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: start; }
.numbered-line span { width: 24px; height: 24px; border-radius: 999px; background: #eef6ff; color: #0b63f6; display: grid; place-items: center; font-size: 12px; font-weight: 900; }
.numbered-line p { margin: 2px 0 0; color: #334155; line-height: 1.45; }
.numbered-line code { margin-top: 1px; color: #0f172a; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
.command-output-panel { grid-column: auto; }
.command-output-list { display: grid; gap: 10px; }
.command-output-row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: start; }
.command-output-row > span { width: 24px; height: 24px; border-radius: 999px; background: #eef6ff; color: #0b63f6; display: grid; place-items: center; font-size: 12px; font-weight: 900; }
.command-output-row > div { display: grid; gap: 7px; min-width: 0; }
.command-output-command { white-space: pre-wrap; word-break: break-word; color: #0f172a; line-height: 1.45; }
.command-output-capture { white-space: pre-wrap; word-break: break-word; color: #d1fae5; background: #07111f; border: 1px solid #0f172a; border-radius: 8px; padding: 10px 12px; line-height: 1.45; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04); }
.command-output-capture.empty-terminal { color: #94a3b8; font-style: italic; }
.script-check-footer { border-top: 1px solid #eef2f7; padding: 9px 14px; color: #64748b; font-size: 12px; background: #fcfcfd; }
.captured-output-panel { border-top: 1px solid #eef2f7; padding: 12px 14px; display: grid; gap: 8px; background: #fcfcfd; }
.captured-output-panel code { white-space: pre-wrap; word-break: break-word; color: #0f172a; }
.captured-output-panel small { color: #64748b; }
.validation-grid { display: grid; grid-template-columns: 1fr 1.4fr 1.3fr 1.2fr; gap: 12px; padding: 12px; border-top: 1px solid #e5e7eb; align-items: start; }
.validation-grid-header { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.validation-grid code, .command-line code { white-space: pre-wrap; word-break: break-word; color: #0f172a; font-size: 13px; }
.command-list { display: grid; border-top: 1px solid #e5e7eb; }
.command-line { display: grid; grid-template-columns: 42px 1fr auto; gap: 12px; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; align-items: start; }
.command-line span { color: #64748b; font-weight: 800; }
.deployment-run-panel { display: grid; gap: 14px; margin-top: 10px; }
.deployment-run-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.deployment-run-header h3 { margin: 0; }
.deployment-run-header p { margin: 4px 0 0; color: #64748b; }
.run-alert { background: #fff7f7; border: 1px solid #fecaca; border-radius: 12px; padding: 12px; }
.run-alert p { margin: 6px 0 0; color: #334155; }
.run-grid { display: grid; grid-template-columns: 1fr 1.3fr 1.4fr 1.4fr auto; gap: 12px; padding: 12px; border-top: 1px solid #e5e7eb; align-items: start; }
.run-grid-header { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.run-grid small { display: block; color: #64748b; margin-top: 5px; line-height: 1.4; }
.run-grid code { white-space: pre-wrap; word-break: break-word; color: #0f172a; font-size: 13px; }
.failure-behaviour-box { background: #fff7f7; border: 1px solid #fecaca; border-radius: 12px; padding: 12px; }
.failure-behaviour-box p { margin: 6px 0 0; color: #334155; line-height: 1.5; }
.empty-pre { display: grid; gap: 5px; padding: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; color: #64748b; }
.empty-pre strong { color: #334155; }
.empty-pre span { line-height: 1.45; }
.template-directory { overflow: hidden; }
.template-directory-toolbar { display: flex; gap: 14px; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; }
.template-card-list { display: grid; }
.template-list-row { width: 100%; border: 0; border-bottom: 1px solid #eef2f7; background: #fff; padding: 16px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.85fr) auto; align-items: center; gap: 18px; text-align: left; cursor: pointer; color: inherit; font: inherit; }
.template-list-row:hover { background: #f8fafc; }
.template-list-row strong { display: block; font-size: 15px; color: #0f172a; }
.template-list-row span { display: block; color: #64748b; font-size: 13px; margin-top: 4px; line-height: 1.4; }
.template-list-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.template-list-meta span { margin: 0; }
.template-edit-page .p-card-body, .template-detail-page .p-card-body { padding: 24px; }
.template-editor-heading h2 { margin: 0; }
.template-editor-heading p { margin: 6px 0 0; color: #64748b; line-height: 1.55; }
.template-submit-footer { display: flex; justify-content: flex-end; padding-top: 18px; border-top: 1px solid #eef2f7; }
.template-detail-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 18px; margin: 18px 0; border-top: 1px solid #eef2f7; border-bottom: 1px solid #eef2f7; }
.template-detail-meta.compact-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 10px 0; }
.policy-create-card .p-card-body { padding: 22px; }
.policy-card-list { display: grid; }
.policy-list-row { cursor: pointer; }
.inline-link-button { justify-self: start; padding-left: 0; }
.template-request-row { grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr) minmax(220px, 0.65fr); cursor: default; }
.template-request-row:hover { background: #fff; }
.request-review-note { display: grid; gap: 4px; color: #64748b; font-size: 13px; line-height: 1.45; }
.request-review-note strong { color: #334155; font-size: 13px; }
.sme-label { margin-top: 18px; }
@media (max-width: 1100px) {
  .side-menu { width: 220px; }
  .main-panel { margin-left: 220px; }
  .top-bar { align-items: flex-start; height: auto; padding: 18px; flex-direction: column; }
  .top-search { width: 100%; }
  .top-actions { flex-wrap: wrap; }
  .form-grid, .review-grid, .template-layout, .device-meta-grid, .finding-detail-grid, .validation-grid, .script-check-columns, .template-list-row, .template-detail-meta, .template-detail-meta.compact-meta, .template-request-row { grid-template-columns: 1fr; }
  .device-info-split { grid-template-columns: 1fr; }
  .device-info-column + .device-info-column { border-left: 0; border-top: 1px solid #e5e7eb; padding-left: 0; margin-left: 0; margin-top: 4px; padding-top: 4px; }
  .numbered-line-panel + .numbered-line-panel { border-left: 0; border-top: 1px solid #eef2f7; }
  .template-directory-toolbar { flex-direction: column; align-items: stretch; }
  .template-list-meta { justify-content: flex-start; }
  .filter-card { flex-direction: column; align-items: stretch; }
  .device-collapse-header, .command-header { flex-direction: column; align-items: stretch; }
  .collapse-meta { justify-content: flex-start; }
}
@media (max-width: 1440px) {
  .table-card .p-datatable .p-datatable-thead { display: none; }
  .table-card .p-datatable-wrapper { overflow-x: hidden; }
  .table-card .p-datatable-table { min-width: 0 !important; }
  .table-card .p-datatable .p-datatable-tbody > tr { display: grid; gap: 10px; padding: 14px; border-bottom: 1px solid #e5e7eb; }
  .table-card .p-datatable .p-datatable-tbody > tr > td { display: grid; grid-template-columns: minmax(120px, 0.38fr) minmax(0, 1fr); gap: 10px; padding: 0; border: 0; align-items: start; }
  .table-card .p-datatable .p-datatable-tbody > tr > td::before { content: attr(data-pc-section); display: none; }
  .table-card .p-column-title { display: block; color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; }
  .table-card .p-datatable .p-datatable-tbody > tr > td > .p-column-title + * { min-width: 0; }
  .action-row { flex-wrap: wrap; gap: 6px; }
  .action-row .p-button { flex: 0 1 auto; min-width: 0; }
}
@media (max-width: 960px) {
  .app-shell { display: block; }
  .main-panel { margin-left: 0; }
  .side-menu { width: 100%; height: auto; position: sticky; top: 0; left: auto; bottom: auto; z-index: 20; border-right: 0; border-bottom: 1px solid #e5e7eb; padding: 14px 16px; }
  .brand { margin-bottom: 12px; }
  .menu-group-label, .menu-footer { display: none; }
  .menu-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; overflow: hidden; padding-bottom: 2px; }
  .menu-item { min-width: 0; justify-content: center; border-radius: 10px; padding: 10px 8px; }
  .menu-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .top-bar { position: static; padding: 16px; }
  .top-actions { width: 100%; gap: 10px; }
  .role-dropdown { width: min(100%, 220px); }
  .page-content { padding: 20px 16px 32px; }
  .page-header h1 { font-size: 26px; }
  .filter-card { padding: 12px; }
  .grow-input { min-width: 0; width: 100%; }
  .detail-header-row, .device-detail-top, .card-title-row, .finding-detail-header, .template-editor-heading, .deployment-run-header { flex-direction: column; align-items: stretch; }
  .detail-actions { padding-top: 0; flex-wrap: wrap; }
  .structured-section-header, .script-editor-head { grid-template-columns: 1fr; flex-direction: column; align-items: stretch; }
}
@media (max-width: 640px) {
  .top-actions { display: grid; grid-template-columns: 1fr; align-items: stretch; }
  .menu-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .menu-item { justify-content: flex-start; }
  .scan-clock { align-items: flex-start; }
  .role-dropdown { width: 100%; }
  .page-content { padding: 16px 12px 28px; }
  .page-header h1 { font-size: 24px; }
  .page-header p { font-size: 14px; }
  .filter-card .p-dropdown, .filter-card .p-multiselect, .template-directory-toolbar .p-button { width: 100%; }
  .meta-tile { grid-template-columns: 1fr; gap: 4px; }
  .meta-tile strong { text-align: left; }
  .table-card .p-datatable .p-datatable-tbody > tr > td { grid-template-columns: 1fr; gap: 4px; }
  .table-card .action-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  .table-card .action-row .p-button { width: 100%; justify-content: center; }
  .action-row .p-button { flex: 1 1 calc(50% - 6px); max-width: 100%; }
  .action-row .p-button .p-button-label { font-size: 13px; }
  .device-cell, .user-cell, .window-cell, .device-mini-card { align-items: flex-start; }
  .device-mini-card { flex-wrap: wrap; }
  .wizard-card .p-card-body { padding: 18px; }
  .ticket-stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wizard-footer { gap: 10px; flex-wrap: wrap; }
  .wizard-footer .p-button { flex: 1 1 180px; }
  .finding-list-header { display: none; }
  .finding-list-row { grid-template-columns: auto minmax(0, 1fr); gap: 12px; }
  .finding-rule-cell, .finding-standard-cell { grid-column: 2; }
  .mobile-field-label { display: block; }
  .command-line { grid-template-columns: 32px minmax(0, 1fr); }
  .command-line .p-tag { grid-column: 2; justify-self: start; }
  .template-list-row { gap: 12px; }
  .template-list-row > i { display: none; }
  .command-edit-row { grid-template-columns: 28px minmax(0, 1fr) auto; gap: 8px; }
}
@media (max-width: 480px) {
  .table-card .action-row { grid-template-columns: 1fr; }
  .table-card .action-row .p-button .p-button-label { flex: 0 0 auto; }
}
`;





