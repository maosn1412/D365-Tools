import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { IconCopy, IconCheck, IconBlocks } from '@/components/ui/icons'

type ComponentType = 'field' | 'dataset'

export function PcfGenerator() {
  const [componentName, setComponentName] = useState('MyCustomControl')
  const [publisherPrefix, setPublisherPrefix] = useState('dev')
  const [componentType, setComponentType] = useState<ComponentType>('field')
  const [useReact, setUseReact] = useState(true)
  const [description, setDescription] = useState('A custom PCF component')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('manifest')

  const fullControlName = `${publisherPrefix}_${componentName}`

  const manifestXml = useMemo(() => {
    const controlType = componentType === 'field' ? 'Standard' : 'DataSet'
    let xml = `<?xml version="1.0" encoding="utf-8" ?>
<manifest>
    <control namespace="${publisherPrefix}"
             constructor="${componentName}"
             version="0.0.1"
             display-name-key="${componentName}"
             description-key="${description}"
             control-type="${controlType}">

        <!-- Property node defines the property that the control maps to -->
        <property name="sampleProperty" display-name-key="Sample_Property" description-key="Sample_Property_Desc" of-type="SingleLine.Text" usage="bound" required="true" />

        <!-- Resource node defines the resources used by the control -->
        <resources>
            <code path="index.ts" order="1" />
            <css path="css/${componentName}.css" order="1" />
        </resources>

        <!-- Feature flag for uncommenting when using feature flags -->
        <!-- <feature-usage>
            <uses-feature name="WebAPI" required="true" />
        </feature-usage> -->

        <property name="colorProperty" display-name-key="Color_Property" description-key="Color_Property_Desc" of-type="SingleLine.Text" usage="input" />
    </control>
</manifest>`
    return xml
  }, [publisherPrefix, componentName, componentType, description])

  const indexTs = useMemo(() => {
    if (useReact) {
      return `import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ${componentName}Component, I${componentName}Props } from "./${componentName}Component";
import * as React from "react";

export class ${componentName} implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private theComponent: ComponentFramework.ReactControl<IInputs, IOutputs>;
    private container: HTMLDivElement;

    constructor() {}

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.container = container;
        const props: I${componentName}Props = {
            context: context,
            notifyOutputChanged: notifyOutputChanged,
        };
        this.theComponent = React.createElement(${componentName}Component, props) as unknown as ComponentFramework.ReactControl<IInputs, IOutputs>;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const props: I${componentName}Props = {
            context: context,
        };
        return React.createElement(${componentName}Component, props);
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {}
}`
    }

    return `import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class ${componentName} implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private notifyOutputChanged: () => void;
    private context: ComponentFramework.Context<IInputs>;

    constructor() {}

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.context = context;
        this.notifyOutputChanged = notifyOutputChanged;
        this.container = container;

        // Initialize your component
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;
        this.render();
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // Clean up
    }

    private render(): void {
        const value = this.context.parameters.sampleProperty.raw || "";
        this.container.innerHTML = \`<div class="${componentName}-container">
            <p>Value: \${value}</p>
        </div>\`;
    }
}`
  }, [componentName, publisherPrefix, useReact])

  const reactComponent = useMemo(() => {
    if (!useReact) return ''
    return `import * as React from "react";
import { IInputs } from "./generated/ManifestTypes";

export interface I${componentName}Props {
    context: ComponentFramework.Context<IInputs>;
    notifyOutputChanged?: () => void;
}

export const ${componentName}Component: React.FC<I${componentName}Props> = (props) => {
    const { context } = props;
    const value = context.parameters.sampleProperty.raw || "";

    return (
        <div className="${componentName}-container">
            <p>Value: {value}</p>
        </div>
    );
};`
  }, [componentName, useReact])

  const cssContent = useMemo(() => {
    return `.${componentName}-container {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: 'Segoe UI', sans-serif;
}

.${componentName}-container p {
    margin: 0;
    color: #333;
}
`
  }, [componentName])

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={<IconBlocks className="h-5 w-5" />}
        title="PCF Component Scaffolding Generator"
        description="Generate PCF (PowerApps Component Framework) component boilerplate files."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Component Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Component Name</Label>
              <Input value={componentName} onChange={(e) => setComponentName(e.target.value)} placeholder="MyCustomControl" />
            </div>
            <div className="space-y-2">
              <Label>Publisher Prefix</Label>
              <Input value={publisherPrefix} onChange={(e) => setPublisherPrefix(e.target.value)} placeholder="dev" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A custom PCF component" />
            </div>
            <div className="space-y-2">
              <Label>Component Type</Label>
              <Select value={componentType} onValueChange={(v) => setComponentType(v as ComponentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="field">Field Control (Standard)</SelectItem>
                  <SelectItem value="dataset">Dataset Control</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 border-t pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useReact} onChange={(e) => setUseReact(e.target.checked)} className="rounded" />
                Use React wrapper
              </label>
            </div>
            <div className="bg-muted p-3 rounded text-sm">
              <p className="font-medium">Full Control Name:</p>
              <code className="text-xs">{fullControlName}</code>
            </div>
          </CardContent>
        </Card>

        {/* Generated Files */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-lg">Generated Files</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={`grid w-full ${useReact ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="manifest">Manifest.xml</TabsTrigger>
                <TabsTrigger value="index">Index.ts</TabsTrigger>
                {useReact && <TabsTrigger value="react">Component.tsx</TabsTrigger>}
                <TabsTrigger value="css">CSS</TabsTrigger>
              </TabsList>

              <TabsContent value="manifest" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(manifestXml)}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Textarea value={manifestXml} readOnly className="font-mono text-sm min-h-[400px] resize-none" />
              </TabsContent>

              <TabsContent value="index" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(indexTs)}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Textarea value={indexTs} readOnly className="font-mono text-sm min-h-[400px] resize-none" />
              </TabsContent>

              <TabsContent value="react" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(reactComponent)}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Textarea value={reactComponent} readOnly className="font-mono text-sm min-h-[400px] resize-none" />
              </TabsContent>

              <TabsContent value="css" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(cssContent)}>
                    {copied ? <IconCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <Textarea value={cssContent} readOnly className="font-mono text-sm min-h-[400px] resize-none" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
