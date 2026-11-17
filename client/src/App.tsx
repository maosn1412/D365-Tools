import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ConnectionStringBuilder } from '@/pages/tools/ConnectionStringBuilder'
import { PowerAutomateExpressions } from '@/pages/tools/PowerAutomateExpressions'
import { FetchXmlBuilder } from '@/pages/tools/FetchXmlBuilder'
import { ODataUrlBuilder } from '@/pages/tools/ODataUrlBuilder'
import { PluginGenerator } from '@/pages/tools/PluginGenerator'
import { PcfGenerator } from '@/pages/tools/PcfGenerator'
import { CustomPageGenerator } from '@/pages/tools/CustomPageGenerator'
import { MetadataViewer } from '@/pages/tools/MetadataViewer'
import { SolutionManager } from '@/pages/tools/SolutionManager'
import { DataQuery } from '@/pages/tools/DataQuery'
import { EnvironmentDashboard } from '@/pages/tools/EnvironmentDashboard'
import { OptionSetViewer } from '@/pages/tools/OptionSetViewer'
import { BusinessRuleInspector } from '@/pages/tools/BusinessRuleInspector'
import { WebResourceManager } from '@/pages/tools/WebResourceManager'
import { SecurityRoleViewer } from '@/pages/tools/SecurityRoleViewer'
import { UserAccessAnalyzer } from '@/pages/tools/UserAccessAnalyzer'
import { RecordAccessChecker } from '@/pages/tools/RecordAccessChecker'
import { RecordSharingAuditor } from '@/pages/tools/RecordSharingAuditor'
import { SecurityRoleCompare } from '@/pages/tools/SecurityRoleCompare'
import { FieldSecurityViewer } from '@/pages/tools/FieldSecurityViewer'
import { PermissionDiagnostic } from '@/pages/tools/PermissionDiagnostic'
import { BusinessUnitHierarchy } from '@/pages/tools/BusinessUnitHierarchy'
import { AuditLogViewer } from '@/pages/tools/AuditLogViewer'
import { ConnectionStringAnalyzer } from '@/pages/tools/ConnectionStringAnalyzer'
import { AzureAdConfigChecker } from '@/pages/tools/AzureAdConfigChecker'
import { PluginProjectScaffolder } from '@/pages/tools/PluginProjectScaffolder'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/tools/connection-string-builder" replace />} />
        {/* Pure frontend tools */}
        <Route path="tools/connection-string-builder" element={<ConnectionStringBuilder />} />
        <Route path="tools/power-automate-expressions" element={<PowerAutomateExpressions />} />
        <Route path="tools/fetchxml-builder" element={<FetchXmlBuilder />} />
        <Route path="tools/odata-url-builder" element={<ODataUrlBuilder />} />
        <Route path="tools/plugin-generator" element={<PluginGenerator />} />
        <Route path="tools/pcf-generator" element={<PcfGenerator />} />
        <Route path="tools/custom-page-generator" element={<CustomPageGenerator />} />
        {/* Tools requiring connection */}
        <Route path="tools/metadata-viewer" element={<MetadataViewer />} />
        <Route path="tools/solution-manager" element={<SolutionManager />} />
        <Route path="tools/data-query" element={<DataQuery />} />
        <Route path="tools/environment-dashboard" element={<EnvironmentDashboard />} />
        <Route path="tools/option-set-viewer" element={<OptionSetViewer />} />
        <Route path="tools/business-rule-inspector" element={<BusinessRuleInspector />} />
        <Route path="tools/web-resource-manager" element={<WebResourceManager />} />
        <Route path="tools/security-role-viewer" element={<SecurityRoleViewer />} />
        <Route path="tools/user-access-analyzer" element={<UserAccessAnalyzer />} />
        <Route path="tools/record-access-checker" element={<RecordAccessChecker />} />
        <Route path="tools/record-sharing-auditor" element={<RecordSharingAuditor />} />
        <Route path="tools/security-role-compare" element={<SecurityRoleCompare />} />
        <Route path="tools/field-security-viewer" element={<FieldSecurityViewer />} />
        <Route path="tools/permission-diagnostic" element={<PermissionDiagnostic />} />
        <Route path="tools/business-unit-hierarchy" element={<BusinessUnitHierarchy />} />
        <Route path="tools/audit-log-viewer" element={<AuditLogViewer />} />
        <Route path="tools/connection-string-analyzer" element={<ConnectionStringAnalyzer />} />
        <Route path="tools/azure-ad-config-checker" element={<AzureAdConfigChecker />} />
        <Route path="tools/plugin-project-scaffolder" element={<PluginProjectScaffolder />} />
        <Route path="*" element={<div className="p-6 text-center text-muted-foreground">Page not found</div>} />
      </Route>
    </Routes>
  )
}

export default App
