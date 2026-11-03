/* Real nks0-api result for beacon-demo-docnet.pcap.
   Technique ids are the backend's, including T1071.004 — do not remap them here.
   Alerts with no mapping omit details.mitre entirely. */
window.NKS_BEACON_DOCNET = {
  "id": "demo",
  "filename": "beacon-demo-docnet.pcap",
  "alerts": [
    {
      "id": "R002",
      "severity": "High",
      "category": "BruteForce",
      "message": "Possible brute-force behavior: 10.0.0.23 made 17 short TCP connections to 192.0.2.30:443.",
      "details": {
        "src_ip": "10.0.0.23",
        "dst_ip": "192.0.2.30",
        "dst_port": 443,
        "protocol": "TCP",
        "attempts": 17,
        "threshold": 10
      },
      "confidence": 0.54,
      "evidence": {
        "attempts": 17,
        "min_attempts_used": 10,
        "attempts_to_threshold_ratio": 1.7,
        "max_duration_seconds": 2,
        "require_no_response": false,
        "flow_key": {
          "src_ip": "10.0.0.23",
          "dst_ip": "192.0.2.30",
          "dst_port": 443,
          "protocol": "TCP"
        }
      },
      "tags": [
        "auth.bruteforce"
      ],
      "first_seen": 1767225601.05,
      "last_seen": 1767227393.596789
    },
    {
      "id": "R002",
      "severity": "High",
      "category": "BruteForce",
      "message": "Possible brute-force behavior: 10.0.0.23 made 30 short TCP connections to 203.0.113.50:8081.",
      "details": {
        "src_ip": "10.0.0.23",
        "dst_ip": "203.0.113.50",
        "dst_port": 8081,
        "protocol": "TCP",
        "attempts": 30,
        "threshold": 10
      },
      "confidence": 0.8,
      "evidence": {
        "attempts": 30,
        "min_attempts_used": 10,
        "attempts_to_threshold_ratio": 3,
        "max_duration_seconds": 2,
        "require_no_response": false,
        "flow_key": {
          "src_ip": "10.0.0.23",
          "dst_ip": "203.0.113.50",
          "dst_port": 8081,
          "protocol": "TCP"
        }
      },
      "tags": [
        "auth.bruteforce"
      ],
      "first_seen": 1767225605,
      "last_seen": 1767227368.44692
    },
    {
      "id": "R002",
      "severity": "High",
      "category": "BruteForce",
      "message": "Possible brute-force behavior: 10.0.0.23 made 40 short TCP connections to 198.51.100.77:443.",
      "details": {
        "src_ip": "10.0.0.23",
        "dst_ip": "198.51.100.77",
        "dst_port": 443,
        "protocol": "TCP",
        "attempts": 40,
        "threshold": 10
      },
      "confidence": 0.8,
      "evidence": {
        "attempts": 40,
        "min_attempts_used": 10,
        "attempts_to_threshold_ratio": 4,
        "max_duration_seconds": 2,
        "require_no_response": false,
        "flow_key": {
          "src_ip": "10.0.0.23",
          "dst_ip": "198.51.100.77",
          "dst_port": 443,
          "protocol": "TCP"
        }
      },
      "tags": [
        "auth.bruteforce"
      ],
      "first_seen": 1767225612,
      "last_seen": 1767227367.373374
    },
    {
      "id": "R002",
      "severity": "High",
      "category": "BruteForce",
      "message": "Possible brute-force behavior: 10.0.0.23 made 14 short TCP connections to 192.0.2.40:443.",
      "details": {
        "src_ip": "10.0.0.23",
        "dst_ip": "192.0.2.40",
        "dst_port": 443,
        "protocol": "TCP",
        "attempts": 14,
        "threshold": 10
      },
      "confidence": 0.52,
      "evidence": {
        "attempts": 14,
        "min_attempts_used": 10,
        "attempts_to_threshold_ratio": 1.4,
        "max_duration_seconds": 2,
        "require_no_response": false,
        "flow_key": {
          "src_ip": "10.0.0.23",
          "dst_ip": "192.0.2.40",
          "dst_port": 443,
          "protocol": "TCP"
        }
      },
      "tags": [
        "auth.bruteforce"
      ],
      "first_seen": 1767225734.943087,
      "last_seen": 1767227294.262535
    },
    {
      "id": "R002",
      "severity": "High",
      "category": "BruteForce",
      "message": "Possible brute-force behavior: 10.0.0.23 made 12 short TCP connections to 192.0.2.10:443.",
      "details": {
        "src_ip": "10.0.0.23",
        "dst_ip": "192.0.2.10",
        "dst_port": 443,
        "protocol": "TCP",
        "attempts": 12,
        "threshold": 10
      },
      "confidence": 0.51,
      "evidence": {
        "attempts": 12,
        "min_attempts_used": 10,
        "attempts_to_threshold_ratio": 1.2,
        "max_duration_seconds": 2,
        "require_no_response": false,
        "flow_key": {
          "src_ip": "10.0.0.23",
          "dst_ip": "192.0.2.10",
          "dst_port": 443,
          "protocol": "TCP"
        }
      },
      "tags": [
        "auth.bruteforce"
      ],
      "first_seen": 1767225740.691475,
      "last_seen": 1767227391.22337
    },
    {
      "id": "R004",
      "severity": "Low",
      "category": "UnusualPort",
      "message": "HTTP-like response on non-standard port: 203.0.113.50:8081 (expected 80, 443, 8080, etc.).",
      "details": {
        "dst_ip": "203.0.113.50",
        "dst_port": 8081,
        "protocol_hint": "HTTP",
        "expected_ports": [
          80,
          443,
          8000,
          8080,
          8443
        ]
      },
      "confidence": 0.6,
      "evidence": {
        "detected_protocol": "HTTP",
        "dst_port": 8081,
        "expected_ports": [
          80,
          443,
          8000,
          8080,
          8443
        ],
        "response_snippet": "HTTP/1.1 200 OK"
      },
      "tags": [
        "anomaly.unusual-port"
      ]
    },
    {
      "id": "R006",
      "severity": "Info",
      "category": "UncommonPorts",
      "message": "Uncommon service ports observed: 1 ports not in common set (e.g. 80, 443, 22).",
      "details": {
        "uncommon_ports": [
          8081
        ],
        "common_ports": [
          21,
          22,
          25,
          53,
          80,
          110,
          143,
          443,
          993,
          995,
          8080,
          8443
        ],
        "total_uncommon": 1
      },
      "confidence": 0.9,
      "evidence": {
        "uncommon_ports": [
          8081
        ],
        "total_uncommon": 1,
        "common_set_size": 12
      },
      "tags": [
        "anomaly.uncommon-ports"
      ]
    },
    {
      "id": "R027",
      "severity": "High",
      "category": "DnsTunnel",
      "message": "DNS tunneling indicators from 10.0.0.23: 0 suspicious label(s), 111 total queries, 60 unique subdomain(s) under 'cdn-sync.example'.",
      "details": {
        "src_ip": "10.0.0.23",
        "suspicious_label_count": 0,
        "total_dns_queries": 111,
        "max_unique_subdomains": 60,
        "top_parent_domain": "cdn-sync.example",
        "sample_labels": [],
        "signals": {
          "long_labels": false,
          "high_query_rate": true,
          "high_subdomain_count": true
        },
        "mitre": {
          "tactic": "Command and Control",
          "techniques": [
            {
              "id": "T1071.004",
              "name": "Application Layer Protocol: DNS"
            },
            {
              "id": "T1048.003",
              "name": "Exfiltration Over Alternative Protocol"
            }
          ]
        }
      },
      "confidence": 0.85,
      "evidence": {
        "src_ip": "10.0.0.23",
        "suspicious_label_count": 0,
        "total_dns_queries": 111,
        "max_unique_subdomains": 60,
        "signal_count": 2
      },
      "tags": [
        "dns",
        "tunneling",
        "exfiltration",
        "c2",
        "dns.tunnel"
      ],
      "first_seen": 1767225601,
      "last_seen": 1767227393.546789
    }
  ]
};
