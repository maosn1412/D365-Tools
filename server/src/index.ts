import express from 'express'
import cors from 'cors'
import { connectionRouter } from './routes/connection.js'
import { metadataRouter } from './routes/metadata.js'
import { solutionRouter } from './routes/solution.js'
import { dataRouter } from './routes/data.js'
import { environmentRouter } from './routes/environment.js'
import { optionsetRouter } from './routes/optionset.js'
import { businessruleRouter } from './routes/businessrule.js'
import { webresourceRouter } from './routes/webresource.js'
import { securityRouter } from './routes/security.js'
import { recordaccessRouter } from './routes/recordaccess.js'
import { fieldsecurityRouter } from './routes/fieldsecurity.js'
import { permissionRouter } from './routes/permission.js'
import { businessunitRouter } from './routes/businessunit.js'
import { auditRouter } from './routes/audit.js'
import { scaffoldRouter } from './routes/scaffold.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/connection', connectionRouter)
app.use('/api/dataverse/metadata', metadataRouter)
app.use('/api/dataverse/solutions', solutionRouter)
app.use('/api/dataverse/data', dataRouter)
app.use('/api/dataverse/environment', environmentRouter)
app.use('/api/dataverse/optionsets', optionsetRouter)
app.use('/api/dataverse/businessrules', businessruleRouter)
app.use('/api/dataverse/webresources', webresourceRouter)
app.use('/api/dataverse/security', securityRouter)
app.use('/api/dataverse/recordaccess', recordaccessRouter)
app.use('/api/dataverse/fieldsecurity', fieldsecurityRouter)
app.use('/api/dataverse/permission', permissionRouter)
app.use('/api/dataverse/businessunit', businessunitRouter)
app.use('/api/dataverse/audit', auditRouter)
app.use('/api/scaffold', scaffoldRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
