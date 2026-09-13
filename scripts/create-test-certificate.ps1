param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
  $san.AddDnsName('localhost')
  $request.CertificateExtensions.Add($san.Build())
  $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1), [DateTimeOffset]::UtcNow.AddHours(1))
  try {
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'cert.pem'), $certificate.ExportCertificatePem())
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'key.pem'), $rsa.ExportPkcs8PrivateKeyPem())
  } finally { $certificate.Dispose() }
} finally { $rsa.Dispose() }
