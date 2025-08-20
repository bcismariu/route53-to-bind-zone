(function () {
    const dropZone = document.getElementById('dropZone');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const output = document.getElementById('output');
    const jsonInput = document.getElementById('jsonInput');
    const jsonCount = document.getElementById('jsonCount');
    const bindCount = document.getElementById('bindCount');
    const status = document.getElementById('status');
    const messages = document.getElementById('messages');

    let lastZoneText = '';
    let lastBlobUrl = null;

    function setStatus(text) { status.textContent = text }
    function addMessage(text, cls) {
        const el = document.createElement('div')
        el.className = cls || 'note'
        el.textContent = text
        messages.appendChild(el)
    }
    function clearMessages() { messages.innerHTML = '' }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(fr.result)
            fr.onerror = () => reject(fr.error)
            fr.readAsText(file)
        })
    }

    function safeTTL(ttl) {
        return (typeof ttl === 'number' && ttl > 0) ? ttl : 300
    }

    function isApex(name, originFqdn) {
        // Both name and originFqdn expected to be fully qualified with trailing dot
        return name === originFqdn
    }

    function formatNameForZonefile(name, originFqdn) {
        if (isApex(name, originFqdn)) return '@'
        if (name.endsWith('.' + originFqdn.slice(0, -1)) || name === originFqdn) {
            return name
        }
        return name
    }

    // Ensure a value is a FQDN (ends with a dot) if it looks like a domain name
    function ensureFqdn(val) {
        if (typeof val !== 'string') return val;
        // If it's an IPv4/IPv6 address, don't add a dot
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(val) || val.includes(':')) return val;
        // If it already ends with a dot, return as is
        if (val.endsWith('.')) return val;
        // If it looks like a domain (contains a dot and no spaces), add a dot
        if (val.match(/^[A-Za-z0-9.-]+$/) && val.includes('.')) return val + '.';
        return val;
    }

    function escapeTxtValue(v) {
        if (v == null) return '""'
        let s = String(v)
        // If it's already quoted, strip outer quotes
        if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
        s = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return '"' + s + '"'
    }

    function metaComment(rr) {
        const parts = []
        if (rr.SetIdentifier) parts.push('SetIdentifier:' + rr.SetIdentifier)
        if (rr.Weight) parts.push('Weight:' + rr.Weight)
        if (rr.Region) parts.push('Region:' + rr.Region)
        if (rr.Failover) parts.push('Failover:' + rr.Failover)
        if (rr.HealthCheckId) parts.push('HealthCheckId:' + rr.HealthCheckId)
        if (rr.GeoLocation) parts.push('Geo:' + JSON.stringify(rr.GeoLocation))
        return parts.length ? '; META: ' + parts.join(' | ') : ''
    }

    function generateZoneText(jsonObj, originArg) {
        const rrsets = jsonObj.ResourceRecordSets || jsonObj.resourceRecordSets || []
        const originRaw = (originArg || '').trim()
        if (!originRaw) throw new Error('Origin is required (e.g. example.com)')
        // ensure trailing dot
        let originFqdn = originRaw
        if (!originFqdn.endsWith('.')) originFqdn = originFqdn + '.'

        const out = []
        out.push(`$ORIGIN ${originFqdn}`)
        out.push(';; Exported from Route 53 JSON (browser converter). Manual review required before import into Cloudflare')
        out.push(';; SOA/NS are commented out below for auditing. Remove or keep commented when importing to Cloudflare.')
        out.push('')

        rrsets.forEach(rr => {
            const name = rr.Name
            const type = rr.Type
            const ttl = safeTTL(rr.TTL)
            const nameOut = formatNameForZonefile(name, originFqdn)

            // SOA/NS -> comment for audit
            if (type === 'SOA') {
                const soaVal = (rr.ResourceRecords && rr.ResourceRecords[0] && rr.ResourceRecords[0].Value) || ''
                out.push(`; SOA ${nameOut} ${ttl} IN SOA ${soaVal}`)
                return
            }
            if (type === 'NS') {
                if (rr.ResourceRecords && Array.isArray(rr.ResourceRecords)) {
                    rr.ResourceRecords.forEach(v => {
                        out.push(`; NS ${nameOut} ${ttl} IN NS ${v.Value}`)
                    })
                } else if (rr.DelegationSetId) {
                    out.push(`; NS ${nameOut} (DelegationSetId: ${rr.DelegationSetId})`)
                } else {
                    out.push(`; NS ${nameOut} (no ResourceRecords)`)
                }
                return
            }

            // AliasTarget handling
            if (rr.AliasTarget) {
                const target = rr.AliasTarget.DNSName || ''
                const hosted = rr.AliasTarget.HostedZoneId || ''
                out.push(`; ALIAS ${nameOut} -> ${target} (HostedZoneId:${hosted}) ${metaComment(rr)}`)
                if (!isApex(name, originFqdn)) {
                    // For non-apex, emit a CNAME line to help imports - be careful: CNAME cannot coexist with other RR types
                    out.push(`${nameOut}\t${ttl}\tIN\tCNAME\t${ensureFqdn(target)}`)
                } else {
                    out.push(`; NOTE: Apex ALIAS present for ${originFqdn}. Recreate using CNAME flattening or A records in your DNS provider.`)
                }
                return
            }

            // ResourceRecords present
            if (rr.ResourceRecords && Array.isArray(rr.ResourceRecords) && rr.ResourceRecords.length) {
                rr.ResourceRecords.forEach(rrv => {
                    let val = (rrv && rrv.Value) ? rrv.Value : ''
                    if (type === 'TXT' || type === 'SPF') {
                        val = escapeTxtValue(val)
                        out.push(`${nameOut}\t${ttl}\tIN\t${type}\t${val}`)
                    } else if (type === 'CNAME' || type === 'MX' || type === 'NS') {
                        // For MX, the value may be "priority target" (e.g., "10 mail.example.com")
                        if (type === 'MX' && val.match(/^\d+\s+\S+/)) {
                            const parts = val.split(/\s+/)
                            const prio = parts.shift()
                            const target = parts.join(' ')
                            out.push(`${nameOut}\t${ttl}\tIN\tMX\t${prio} ${ensureFqdn(target)}`)
                        } else {
                            out.push(`${nameOut}\t${ttl}\tIN\t${type}\t${ensureFqdn(val)}`)
                        }
                    } else {
                        out.push(`${nameOut}\t${ttl}\tIN\t${type}\t${val}`)
                    }
                })
                const meta = metaComment(rr)
                if (meta) out.push(meta)
                return
            }

            // No ResourceRecords or AliasTarget -> comment
            out.push(`; SKIPPED ${nameOut} ${type} (no ResourceRecords, no AliasTarget) ${metaComment(rr)}`)
        })

        out.push('')
        out.push(';; End of export. Please verify TXT, DKIM, MX and Alias records before importing.')
        return out.join('\n')
    }

    async function handleFile(file) {
        clearMessages()
        setStatus('Reading file...')
        try {
            const text = await readFileAsText(file)
            // Attempt parse
            let jsonObj
            try {
                jsonObj = JSON.parse(text)
            } catch (err) {
                throw new Error('Invalid JSON: ' + err.message)
            }
            setStatus('File parsed. Waiting for convert...')
            // Pre-populate origin if possible from HostedZones? Not available here.
            // Keep jsonObj for conversion on button press by storing in closure (or reuse function param)
            return jsonObj
        } finally {
            setStatus('')
        }
    }

    function updateJsonCount() {
        let count = 0;
        try {
            const val = jsonInput.value.trim();
            if (val) {
                const obj = JSON.parse(val);
                if (obj && (Array.isArray(obj.ResourceRecordSets) || Array.isArray(obj.resourceRecordSets))) {
                    count = (obj.ResourceRecordSets || obj.resourceRecordSets || []).length;
                }
            }
        } catch (e) {}
        jsonCount.textContent = `Entries: ${count}`;
    }

    function updateBindCount() {
        // Count non-empty, non-comment, non-directive lines using the rendered <div>s
        let count = 0;
        for (const child of output.children) {
            const l = child.textContent.trim();
            if (!l) continue;
            if (l.startsWith(';')) continue;
            if (l.startsWith('$')) continue;
            count++;
        }
        bindCount.textContent = `Entries: ${count}`;
    }

    jsonInput.addEventListener('input', () => {
        updateJsonCount();
        autoConvert();
    });
    output.addEventListener('input', updateBindCount);

    // Drag and drop file support
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-blue-100');
    });
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-100');
    });
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-100');
        clearMessages();
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        if (!file.name.endsWith('.json')) {
            addMessage('Please drop a .json file.', 'error');
            return;
        }
        setStatus('Reading file: ' + file.name);
        try {
            const jsonObj = await handleFile(file);
            window.__r53_json = jsonObj;
            jsonInput.value = JSON.stringify(jsonObj, null, 2);
            updateJsonCount();
            autoConvert();
        } catch (err) {
            addMessage('Error: ' + err.message, 'error');
        } finally {
            setStatus('');
        }
    });


    function inferOriginFromJson(jsonObj) {
        // Try to infer the apex domain from the first record's Name
        const rrsets = jsonObj.ResourceRecordSets || jsonObj.resourceRecordSets || [];
        if (rrsets.length > 0 && rrsets[0].Name) {
            // Remove trailing dot if present
            let name = rrsets[0].Name;
            if (name.endsWith('.')) name = name.slice(0, -1);
            // If it's a subdomain, get the last two/three labels (simple guess)
            const parts = name.split('.');
            if (parts.length >= 2) {
                // Try to find the most common root among all names
                // But for now, just use the longest common suffix among all names
                let suffix = parts.slice(-2).join('.');
                // Try to improve: find the longest common suffix among all names
                const allNames = rrsets.map(r => r.Name.endsWith('.') ? r.Name.slice(0, -1) : r.Name);
                let minParts = allNames[0].split('.');
                for (let i = 1; i < allNames.length; i++) {
                    const p = allNames[i].split('.');
                    let j = minParts.length - 1, k = p.length - 1;
                    while (j >= 0 && k >= 0 && minParts[j] === p[k]) {
                        j--; k--;
                    }
                    minParts = minParts.slice(j + 1);
                }
                if (minParts.length > 1) {
                    suffix = minParts.join('.');
                }
                return suffix;
            }
        }
        return '';
    }

    let lastOrigin = '';
    function autoConvert() {
        clearMessages();
        let jsonObj = null;
        try {
            jsonObj = JSON.parse(jsonInput.value);
            window.__r53_json = jsonObj;
        } catch (err) {
            addMessage('Invalid JSON in input area: ' + err.message, 'error');
            output.innerHTML = '';
            downloadBtn.classList.add('hidden');
            updateBindCount();
            lastOrigin = '';
            return;
        }
        // Always infer origin from JSON
        let originVal = inferOriginFromJson(jsonObj);
        lastOrigin = originVal || '';
        if (!originVal) {
            addMessage('Could not infer origin from JSON. Please check your input.', 'error');
            output.innerHTML = '';
            downloadBtn.classList.add('hidden');
            updateBindCount();
            return;
        }
        try {
            const zoneText = generateZoneText(jsonObj, originVal);
            lastZoneText = zoneText;
            renderZonefile(zoneText);
            addMessage('Zonefile generated. Inspect carefully (TXT, aliases and health/failover entries may need manual work).');
            downloadBtn.disabled = false;
            // Show download button only if there is valid output
            const hasValid = Array.from(output.children).some(child => {
                const l = child.textContent.trim();
                return l && !l.startsWith(';') && !l.startsWith('$');
            });
            if (hasValid) {
                downloadBtn.classList.remove('hidden');
            } else {
                downloadBtn.classList.add('hidden');
            }
            updateBindCount();
        } catch (err) {
            addMessage('Conversion error: ' + err.message, 'error');
            output.innerHTML = '';
            downloadBtn.classList.add('hidden');
            updateBindCount();
        }
    }

    function renderZonefile(zoneText) {
        // Highlight commented-out (removed) entries with a light gray background
        // Only highlight lines that start with ; SKIPPED or ; SOA/NS/ALIAS/NS
        const lines = zoneText.split(/\r?\n/);
        output.innerHTML = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('; SKIPPED') ||
                (trimmed.startsWith('; SOA') || trimmed.startsWith('; NS') || trimmed.startsWith('; ALIAS'))) {
                return `<div class=\"bg-gray-100\">${escapeHtml(line)}</div>`;
            }
            return `<div>${escapeHtml(line)}</div>`;
        }).join('');
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function (c) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }

    downloadBtn.addEventListener('click', () => {
        if (!lastZoneText) {
            addMessage('Nothing to download.', 'error')
            return
        }
        if (lastBlobUrl) {
            URL.revokeObjectURL(lastBlobUrl)
            lastBlobUrl = null
        }
        let filename = 'zonefile.db';
        if (lastOrigin) {
            filename = lastOrigin.replace(/\.+$/, '') + '.db';
        }
        const blob = new Blob([lastZoneText], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        lastBlobUrl = url
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => {
            if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl)
            lastBlobUrl = null
        }, 2000)
    })

    clearBtn.addEventListener('click', () => {
        output.innerHTML = '';
        jsonInput.value = '';
        window.__r53_json = null;
        lastZoneText = '';
        lastOrigin = '';
        downloadBtn.disabled = true;
        downloadBtn.classList.add('hidden');
        clearMessages();
        updateJsonCount();
        updateBindCount();
    });

    // Initial count update
    updateJsonCount();
    updateBindCount();

})();
