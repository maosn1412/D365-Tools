import { ClientSecretCredential, UsernamePasswordCredential, type TokenCredential, AzureAuthorityHosts } from '@azure/identity'
import axios from 'axios'

function getAuthorityOptions(environmentUrl: string) {
  // Note: crm5/crm8 *.dynamics.com environments are bound to public-cloud tenants, so the
  // China authority fails there with AADSTS90002 (verified via WhoAmI). Only genuine China
  // AAD environments (*.dynamics.cn) use the China authority.
  if (environmentUrl.includes('.dynamics.cn')) {
    return { authorityHost: AzureAuthorityHosts.AzureChina }
  }
  return {}
}

export class DataverseService {
  private static instance: DataverseService
  private credential: TokenCredential | null = null
  private environmentUrl: string = ''
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null

  private constructor() {}

  static getInstance(): DataverseService {
    if (!DataverseService.instance) {
      DataverseService.instance = new DataverseService()
    }
    return DataverseService.instance
  }

  async connectWithClientSecret(
    tenantId: string,
    clientId: string,
    clientSecret: string,
    environmentUrl: string
  ): Promise<void> {
    const nextEnvironmentUrl = environmentUrl.replace(/\/$/, '')
    const options = getAuthorityOptions(nextEnvironmentUrl)
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret, options)
    const tokenResponse = await credential.getToken(`${nextEnvironmentUrl}/.default`)
    if (!tokenResponse) {
      throw new Error('Failed to acquire access token')
    }

    this.credential = credential
    this.environmentUrl = nextEnvironmentUrl
    this.accessToken = tokenResponse.token
    this.tokenExpiry = tokenResponse.expiresOnTimestamp
      ? new Date(tokenResponse.expiresOnTimestamp)
      : new Date(Date.now() + 3600 * 1000)
  }

  async connectWithUsernamePassword(
    tenantId: string,
    clientId: string,
    username: string,
    password: string,
    environmentUrl: string
  ): Promise<void> {
    const nextEnvironmentUrl = environmentUrl.replace(/\/$/, '')
    const options = getAuthorityOptions(nextEnvironmentUrl)
    const credential = new UsernamePasswordCredential(
      tenantId,
      clientId,
      username,
      password,
      options
    )
    const tokenResponse = await credential.getToken(`${nextEnvironmentUrl}/.default`)
    if (!tokenResponse) {
      throw new Error('Failed to acquire access token')
    }

    this.credential = credential
    this.environmentUrl = nextEnvironmentUrl
    this.accessToken = tokenResponse.token
    this.tokenExpiry = tokenResponse.expiresOnTimestamp
      ? new Date(tokenResponse.expiresOnTimestamp)
      : new Date(Date.now() + 3600 * 1000)
  }

  disconnect(): void {
    this.credential = null
    this.accessToken = null
    this.tokenExpiry = null
    this.environmentUrl = ''
  }

  isConnected(): boolean {
    return this.credential !== null && this.environmentUrl !== ''
  }

  // Full Web API URL for an entity reference, used to build @odata.id
  // payloads server-side so clients only ever send GUIDs.
  buildEntityUrl(path: string): string {
    return `${this.environmentUrl}/api/data/v9.2${path}`
  }

  private async ensureToken(): Promise<string> {
    if (!this.credential) {
      throw new Error('Not connected to Dataverse')
    }

    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken
    }

    const resource = `${this.environmentUrl}/.default`
    const tokenResponse = await this.credential.getToken(resource)

    if (!tokenResponse) {
      throw new Error('Failed to acquire access token')
    }

    this.accessToken = tokenResponse.token
    this.tokenExpiry = tokenResponse.expiresOnTimestamp
      ? new Date(tokenResponse.expiresOnTimestamp)
      : new Date(Date.now() + 3600 * 1000)

    return this.accessToken
  }

  private getHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Accept': 'application/json',
    }
  }

  private async requestWithRetry<T>(requestFn: () => Promise<T>, url: string, maxRetries = 2): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn()
      } catch (error) {
        // Note: when the socket resets mid-body, axios still exposes
        // error.response (headers arrived) with code ECONNRESET, so the
        // retry decision must not require !error.response.
        const isNetworkError = axios.isAxiosError(error) && (
          error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED'
        )
        if (isNetworkError && attempt < maxRetries) {
          console.log(`[Retry] Network error on attempt ${attempt + 1}/${maxRetries + 1} for ${url}, retrying...`)
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw error
      }
    }
    throw new Error('Unreachable')
  }

  async get(path: string): Promise<unknown> {
    const token = await this.ensureToken()
    const url = `${this.environmentUrl}/api/data/v9.2${path}`

    try {
      console.log(`[Dataverse GET] ${url}`)
      const data = await this.requestWithRetry(
        () => axios.get(url, { headers: this.getHeaders(token), timeout: 60000 }).then(r => r.data),
        url
      )
      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const rawData = error.response?.data
        const body = rawData ? JSON.stringify(rawData).substring(0, 500) : error.message
        console.error(`[Dataverse API error] GET ${path}: ${status ?? 'network'} - ${body}`)
        if (status) {
          throw new Error(`Dataverse API error: ${status} - ${body}`)
        }
        throw new Error(`Failed to fetch ${url}: ${error.message}`)
      }
      console.error(`[Unknown error] GET ${url}:`, error)
      throw new Error(`Failed to fetch ${url}: Unknown error`)
    }
  }

  async post(path: string, body: unknown): Promise<unknown> {
    const token = await this.ensureToken()
    const url = `${this.environmentUrl}/api/data/v9.2${path}`

    try {
      console.log(`[Dataverse POST] ${url}`)
      const data = await this.requestWithRetry(
        () => axios.post(url, body, { headers: this.getHeaders(token), timeout: 60000 }).then(r => r.data),
        url
      )
      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const rawData = error.response?.data
        const body = rawData ? JSON.stringify(rawData).substring(0, 500) : error.message
        console.error(`[Dataverse API error] POST ${path}: ${status ?? 'network'} - ${body}`)
        if (status) {
          throw new Error(`Dataverse API error: ${status} - ${body}`)
        }
        throw new Error(`Failed to post ${url}: ${error.message}`)
      }
      console.error(`[Unknown error] POST ${url}:`, error)
      throw new Error(`Failed to post ${url}: Unknown error`)
    }
  }

  async delete(path: string, queryParams?: Record<string, string>): Promise<void> {
    const token = await this.ensureToken()
    const url = `${this.environmentUrl}/api/data/v9.2${path}`

    try {
      console.log(`[Dataverse DELETE] ${url}`)
      await this.requestWithRetry(
        () => axios.delete(url, { params: queryParams, headers: this.getHeaders(token), timeout: 60000 }),
        url
      )
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const rawData = error.response?.data
        const body = rawData ? JSON.stringify(rawData).substring(0, 500) : error.message
        console.error(`[Dataverse API error] DELETE ${path}: ${status ?? 'network'} - ${body}`)
        if (status) {
          throw new Error(`Dataverse API error: ${status} - ${body}`)
        }
        throw new Error(`Failed to delete ${url}: ${error.message}`)
      }
      console.error(`[Unknown error] DELETE ${url}:`, error)
      throw new Error(`Failed to delete ${url}: Unknown error`)
    }
  }

  async getWithQuery(path: string, queryParams: Record<string, string>): Promise<unknown> {
    const token = await this.ensureToken()
    const url = `${this.environmentUrl}/api/data/v9.2${path}`

    try {
      console.log(`[Dataverse GET] ${url} params=${JSON.stringify(queryParams)}`)
      const data = await this.requestWithRetry(
        () => axios.get(url, { params: queryParams, headers: this.getHeaders(token), timeout: 60000 }).then(r => r.data),
        url
      )
      return data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const rawData = error.response?.data
        const body = rawData ? JSON.stringify(rawData).substring(0, 500) : error.message
        console.error(`[Dataverse API error] GET ${path}: ${status ?? 'network'} - ${body}`)
        if (status) {
          throw new Error(`Dataverse API error: ${status} - ${body}`)
        }
        throw new Error(`Failed to fetch ${url}: ${error.message}`)
      }
      console.error(`[Unknown error] GET ${url}:`, error)
      throw new Error(`Failed to fetch ${url}: Unknown error`)
    }
  }
}
