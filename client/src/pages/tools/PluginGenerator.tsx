import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import { SearchSelect } from '@/components/ui/search-select'
import { IconCopy, IconCheck, IconPlugin } from '@/components/ui/icons'
import { useMetadataEntities } from '@/hooks/useMetadata'

type PipelineStage = 'PreValidation' | 'PreOperation' | 'PostOperation'
type Message = 'Create' | 'Update' | 'Delete' | 'SetState' | 'Associate' | 'Disassociate'

export function PluginGenerator() {
  const [className, setClassName] = useState('AccountPlugin')
  const [namespace, setNamespace] = useState('MyCompany.Plugins')
  const [entity, setEntity] = useState('account')
  const [message, setMessage] = useState<Message>('Create')
  const [stage, setStage] = useState<PipelineStage>('PostOperation')
  const [includeLogging, setIncludeLogging] = useState(true)
  const [includeErrorHandling, setIncludeErrorHandling] = useState(true)
  const [includeServiceContext, setIncludeServiceContext] = useState(true)
  const [copied, setCopied] = useState(false)

  // Connection-aware entity dropdown (plain input when not connected)
  const { connected, options: entityOptions, loading: entitiesLoading } = useMetadataEntities()

  const generatedCode = useMemo(() => {
    const stageEnum = stage === 'PreValidation' ? '10' : stage === 'PreOperation' ? '20' : '40'
    const stageName = stage === 'PreValidation' ? 'PreValidation' : stage === 'PreOperation' ? 'PreOperation' : 'PostOperation'

    let code = `using System;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;`

    if (includeServiceContext) {
      code += `\nusing Microsoft.Xrm.Sdk.Client;`
    }

    code += `\n\nnamespace ${namespace}\n{\n`
    code += `    /// <summary>\n    /// Plugin for ${entity} - ${message} message (${stageName} stage)\n    /// </summary>\n`
    code += `    public class ${className} : IPlugin\n    {\n`
    code += `        private readonly ITracingService tracingService;\n`
    code += `        private readonly IOrganizationServiceFactory serviceFactory;\n\n`

    // Constructor
    code += `        public ${className}(string unsecureConfig, string secureConfig)\n`
    code += `        {\n`
    code += `            // Plugin configuration from registration\n`
    code += `        }\n\n`

    // Execute method
    code += `        public void Execute(IServiceProvider serviceProvider)\n`
    code += `        {\n`

    if (includeLogging) {
      code += `            tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));\n`
      code += `            tracingService.Trace("Plugin execution started - ${className}");\n\n`
    }

    code += `            serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));\n`
    code += `            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));\n`
    code += `            var service = serviceFactory.CreateOrganizationService(context.UserId);\n\n`

    code += `            try\n`
    code += `            {\n`

    if (includeLogging) {
      code += `                tracingService.Trace("Message: {0}, Entity: {1}, Stage: {2}",\n`
      code += `                    context.MessageName, context.PrimaryEntityName, context.Stage);\n\n`
    }

    // Entity references based on message
    if (message === 'Create' || message === 'Update') {
      code += `                // Get the target entity from the execution context\n`
      code += `                var targetEntity = context.InputParameters["Target"] as Entity;\n\n`
      code += `                if (targetEntity == null)\n`
      code += `                {\n`
      code += `                    throw new InvalidPluginExecutionException("Target entity is null.");\n`
      code += `                }\n\n`
      code += `                var entityId = targetEntity.Id;\n`
      code += `                var entityLogicalName = targetEntity.LogicalName;\n\n`
    } else if (message === 'Delete') {
      code += `                // Get the target entity reference\n`
      code += `                var targetRef = context.InputParameters["Target"] as EntityReference;\n\n`
      code += `                if (targetRef == null)\n`
      code += `                {\n`
      code += `                    throw new InvalidPluginExecutionException("Target reference is null.");\n`
      code += `                }\n\n`
      code += `                var entityId = targetRef.Id;\n`
      code += `                var entityLogicalName = targetRef.LogicalName;\n\n`
    } else {
      code += `                // Access context parameters\n`
      code += `                var entityLogicalName = context.PrimaryEntityName;\n\n`
    }

    if (stage === 'PostOperation' && (message === 'Create' || message === 'Update')) {
      code += `                // PostOperation: Retrieve the created/updated entity if needed\n`
      code += `                var postImage = context.PostEntityImages.ContainsKey("PostImage")\n`
      code += `                    ? context.PostEntityImages["PostImage"] : null;\n\n`
    }

    if (stage === 'PreOperation' && message === 'Update') {
      code += `                // PreOperation: Access pre-image for comparison\n`
      code += `                var preImage = context.PreEntityImages.ContainsKey("PreImage")\n`
      code += `                    ? context.PreEntityImages["PreImage"] : null;\n\n`
    }

    code += `                // TODO: Add your business logic here\n`
    code += `                // Example: Update a field\n`
    code += `                // var updateEntity = new Entity(entityLogicalName, entityId);\n`
    code += `                // updateEntity["new_customfield"] = "value";\n`
    code += `                // service.Update(updateEntity);\n\n`

    if (includeLogging) {
      code += `                tracingService.Trace("Plugin execution completed successfully.");\n`
    }

    code += `            }\n`

    if (includeErrorHandling) {
      code += `            catch (InvalidPluginExecutionException)\n`
      code += `            {\n`
      code += `                throw; // Re-throw plugin exceptions\n`
      code += `            }\n`
      code += `            catch (FaultException<OrganizationServiceFault> ex)\n`
      code += `            {\n`
      if (includeLogging) {
        code += `                tracingService.Trace("Organization service fault: {0}", ex.Message);\n`
      }
      code += `                throw new InvalidPluginExecutionException("An error occurred in the ${className} plugin.", ex);\n`
      code += `            }\n`
      code += `            catch (Exception ex)\n`
      code += `            {\n`
      if (includeLogging) {
        code += `                tracingService.Trace("Unexpected error: {0}", ex.Message);\n`
      }
      code += `                throw new InvalidPluginExecutionException("An unexpected error occurred.", ex);\n`
      code += `            }\n`
    }

    code += `        }\n`
    code += `    }\n`
    code += `}\n\n`

    // Registration info
    code += `// ============================================\n`
    code += `// Plugin Registration Info\n`
    code += `// ============================================\n`
    code += `// Entity Logical Name: ${entity}\n`
    code += `// Message: ${message}\n`
    code += `// Pipeline Stage: ${stageName} (${stageEnum})\n`
    code += `// Execution Mode: ${stage === 'PreValidation' ? 'Synchronous' : 'Synchronous'}\n`
    code += `// Assembly: ${namespace}.dll\n`
    code += `// Class: ${namespace}.${className}\n`

    if (message === 'Create' || message === 'Update') {
      code += `// Post Image Alias: PostImage (all attributes)\n`
    }
    if (message === 'Update' && stage === 'PreOperation') {
      code += `// Pre Image Alias: PreImage (all attributes)\n`
    }

    return code
  }, [className, namespace, entity, message, stage, includeLogging, includeErrorHandling, includeServiceContext])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconPlugin className="h-5 w-5" />}
        title="Plugin Code Generator"
        description="Generate D365 Plugin boilerplate code (IPlugin interface implementation)."
      />

      <div className="grid grid-cols-[360px_1fr] gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plugin Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Class Name</Label>
                <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="AccountPlugin" />
              </div>
              <div className="space-y-2">
                <Label>Namespace</Label>
                <Input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="MyCompany.Plugins" />
              </div>
              <div className="space-y-2">
                <Label>Target Entity</Label>
                {connected ? (
                  <SearchSelect
                    value={entity}
                    onChange={setEntity}
                    options={entityOptions}
                    loading={entitiesLoading}
                    placeholder="Select an entity..."
                    panelPlaceholder="Search entities..."
                    triggerClassName="h-10"
                  />
                ) : (
                  <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="account" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Select value={message} onValueChange={(v) => setMessage(v as Message)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Create">Create</SelectItem>
                    <SelectItem value="Update">Update</SelectItem>
                    <SelectItem value="Delete">Delete</SelectItem>
                    <SelectItem value="SetState">SetState</SelectItem>
                    <SelectItem value="Associate">Associate</SelectItem>
                    <SelectItem value="Disassociate">Disassociate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pipeline Stage</Label>
                <Select value={stage} onValueChange={(v) => setStage(v as PipelineStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PreValidation">PreValidation (Stage 10)</SelectItem>
                    <SelectItem value="PreOperation">PreOperation (Stage 20)</SelectItem>
                    <SelectItem value="PostOperation">PostOperation (Stage 40)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 border-t pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeLogging} onChange={(e) => setIncludeLogging(e.target.checked)} className="rounded" />
                  Include Tracing/Logging
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeErrorHandling} onChange={(e) => setIncludeErrorHandling(e.target.checked)} className="rounded" />
                  Include Error Handling
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={includeServiceContext} onChange={(e) => setIncludeServiceContext(e.target.checked)} className="rounded" />
                  Include Service Context using
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Generated Code</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea value={generatedCode} readOnly className="font-mono text-sm min-h-[600px] resize-none" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
