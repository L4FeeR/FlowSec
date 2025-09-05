import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// VirusTotal API configuration
const VIRUSTOTAL_API_KEY = '8a2a9809b18ab04dc168df26000af4490beeaf2d4a42e1b90f1989b23d2bb630';
const VIRUSTOTAL_BASE_URL = 'https://www.virustotal.com/vtapi/v2';

class SecurityScanner {
    constructor() {
        this.apiKey = VIRUSTOTAL_API_KEY;
        this.scanResults = new Map(); // Cache scan results
    }

    // Calculate file hash (SHA256)
    calculateFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            console.error('Error calculating file hash:', error);
            return null;
        }
    }

    // Calculate URL hash for caching
    calculateUrlHash(url) {
        const hashSum = crypto.createHash('sha256');
        hashSum.update(url);
        return hashSum.digest('hex');
    }

    // Scan file with VirusTotal
    async scanFile(filePath, fileName) {
        try {
            const fileHash = this.calculateFileHash(filePath);
            if (!fileHash) {
                throw new Error('Could not calculate file hash');
            }

            // Check if we already have results for this hash
            if (this.scanResults.has(fileHash)) {
                return this.scanResults.get(fileHash);
            }

            // First, check if file is already known to VirusTotal
            const reportResponse = await this.getFileReport(fileHash);
            
            if (reportResponse.response_code === 1) {
                // File is known, return existing results
                const result = this.formatFileResult(reportResponse, fileHash, fileName);
                this.scanResults.set(fileHash, result);
                return result;
            }

            // File is unknown, submit for scanning
            const scanResponse = await this.submitFileForScanning(filePath, fileName);
            
            if (scanResponse.response_code === 1) {
                // File submitted successfully, return pending status
                const result = {
                    id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: fileName,
                    hash: fileHash,
                    status: 'scanning',
                    scanDate: new Date().toISOString(),
                    virusTotalId: scanResponse.scan_id,
                    threats: [],
                    engines: {
                        total: 0,
                        positives: 0
                    }
                };
                
                this.scanResults.set(fileHash, result);
                return result;
            } else {
                throw new Error('Failed to submit file for scanning');
            }

        } catch (error) {
            console.error('File scanning error:', error);
            return {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: fileName,
                hash: this.calculateFileHash(filePath),
                status: 'error',
                scanDate: new Date().toISOString(),
                error: error.message,
                threats: [],
                engines: {
                    total: 0,
                    positives: 0
                }
            };
        }
    }

    // Get file report from VirusTotal
    async getFileReport(fileHash) {
        const url = `${VIRUSTOTAL_BASE_URL}/file/report`;
        const params = new URLSearchParams({
            apikey: this.apiKey,
            resource: fileHash
        });

        const response = await fetch(`${url}?${params}`);
        return await response.json();
    }

    // Submit file for scanning
    async submitFileForScanning(filePath, fileName) {
        const url = `${VIRUSTOTAL_BASE_URL}/file/scan`;
        const formData = new FormData();
        
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        
        formData.append('apikey', this.apiKey);
        formData.append('file', blob, fileName);

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        return await response.json();
    }

    // Scan URL with VirusTotal
    async scanUrl(url) {
        try {
            const urlHash = this.calculateUrlHash(url);
            
            // Check cache first
            if (this.scanResults.has(urlHash)) {
                return this.scanResults.get(urlHash);
            }

            // Get URL report
            const reportResponse = await this.getUrlReport(url);
            
            if (reportResponse.response_code === 1) {
                // URL is known, return results
                const result = this.formatUrlResult(reportResponse, url);
                this.scanResults.set(urlHash, result);
                return result;
            }

            // URL is unknown, submit for scanning
            const scanResponse = await this.submitUrlForScanning(url);
            
            if (scanResponse.response_code === 1) {
                // URL submitted successfully
                const result = {
                    id: `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    url: url,
                    domain: this.extractDomain(url),
                    status: 'scanning',
                    scanDate: new Date().toISOString(),
                    virusTotalId: scanResponse.scan_id,
                    threats: [],
                    engines: {
                        total: 0,
                        positives: 0
                    }
                };
                
                this.scanResults.set(urlHash, result);
                return result;
            } else {
                throw new Error('Failed to submit URL for scanning');
            }

        } catch (error) {
            console.error('URL scanning error:', error);
            return {
                id: `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                url: url,
                domain: this.extractDomain(url),
                status: 'error',
                scanDate: new Date().toISOString(),
                error: error.message,
                threats: [],
                engines: {
                    total: 0,
                    positives: 0
                }
            };
        }
    }

    // Get URL report from VirusTotal
    async getUrlReport(url) {
        const reportUrl = `${VIRUSTOTAL_BASE_URL}/url/report`;
        const params = new URLSearchParams({
            apikey: this.apiKey,
            resource: url
        });

        const response = await fetch(`${reportUrl}?${params}`);
        return await response.json();
    }

    // Submit URL for scanning
    async submitUrlForScanning(url) {
        const scanUrl = `${VIRUSTOTAL_BASE_URL}/url/scan`;
        const params = new URLSearchParams({
            apikey: this.apiKey,
            url: url
        });

        const response = await fetch(scanUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        return await response.json();
    }

    // Format file scan result
    formatFileResult(vtResult, fileHash, fileName) {
        const positives = vtResult.positives || 0;
        const total = vtResult.total || 0;
        
        let status = 'safe';
        if (positives > 0) {
            status = 'malicious';
        } else if (total === 0) {
            status = 'pending';
        }

        const threats = [];
        if (vtResult.scans) {
            Object.entries(vtResult.scans).forEach(([engine, result]) => {
                if (result.detected) {
                    threats.push({
                        engine: engine,
                        name: result.result,
                        level: this.getThreatLevel(result.result),
                        description: `Detected by ${engine}: ${result.result}`
                    });
                }
            });
        }

        return {
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: fileName,
            hash: fileHash,
            status: status,
            scanDate: new Date().toISOString(),
            virusTotalId: vtResult.scan_id,
            threats: threats,
            engines: {
                total: total,
                positives: positives
            },
            permalink: vtResult.permalink
        };
    }

    // Format URL scan result
    formatUrlResult(vtResult, url) {
        const positives = vtResult.positives || 0;
        const total = vtResult.total || 0;
        
        let status = 'safe';
        if (positives > 0) {
            status = 'malicious';
        } else if (total === 0) {
            status = 'pending';
        }

        const threats = [];
        if (vtResult.scans) {
            Object.entries(vtResult.scans).forEach(([engine, result]) => {
                if (result.detected) {
                    threats.push({
                        engine: engine,
                        name: result.result,
                        level: this.getThreatLevel(result.result),
                        description: `Detected by ${engine}: ${result.result}`
                    });
                }
            });
        }

        return {
            id: `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: url,
            domain: this.extractDomain(url),
            status: status,
            scanDate: new Date().toISOString(),
            virusTotalId: vtResult.scan_id,
            threats: threats,
            engines: {
                total: total,
                positives: positives
            },
            permalink: vtResult.permalink
        };
    }

    // Determine threat level
    getThreatLevel(threatName) {
        const threatLower = threatName.toLowerCase();
        
        if (threatLower.includes('trojan') || threatLower.includes('ransomware') || 
            threatLower.includes('backdoor') || threatLower.includes('rootkit')) {
            return 'high';
        } else if (threatLower.includes('adware') || threatLower.includes('pup') || 
                   threatLower.includes('potentially unwanted')) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    // Extract domain from URL
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            return 'unknown';
        }
    }

    // Get scan result by ID
    async getScanResult(scanId) {
        try {
            const url = `${VIRUSTOTAL_BASE_URL}/file/report`;
            const params = new URLSearchParams({
                apikey: this.apiKey,
                resource: scanId
            });

            const response = await fetch(`${url}?${params}`);
            const result = await response.json();

            return result;
        } catch (error) {
            console.error('Error getting scan result:', error);
            return null;
        }
    }

    // Rescan file or URL
    async rescan(resourceId, type = 'file') {
        try {
            const url = `${VIRUSTOTAL_BASE_URL}/${type}/rescan`;
            const params = new URLSearchParams({
                apikey: this.apiKey,
                resource: resourceId
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            return await response.json();
        } catch (error) {
            console.error('Rescan error:', error);
            return { response_code: 0, error: error.message };
        }
    }

    // Clean up old scan results (older than 24 hours)
    cleanupOldResults() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (const [key, result] of this.scanResults.entries()) {
            const resultTime = new Date(result.scanDate).getTime();
            if (resultTime < oneDayAgo) {
                this.scanResults.delete(key);
            }
        }
    }

    // Get API usage info
    async getApiUsage() {
        try {
            // VirusTotal doesn't have a direct API usage endpoint in v2
            // This is a placeholder for tracking usage internally
            return {
                dailyLimit: 1000,
                used: 0, // You would track this internally
                remaining: 1000
            };
        } catch (error) {
            console.error('Error getting API usage:', error);
            return null;
        }
    }
}

export default SecurityScanner;
