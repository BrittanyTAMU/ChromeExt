# PowerShell script to create placeholder icons for extensions
# Run this script to generate simple placeholder icons

$extensions = @("tinder", "bumble", "grindr", "premium")

foreach ($ext in $extensions) {
    $extPath = ".\$ext"
    
    # Create simple SVG icons as placeholders
    $icon16 = @"
<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <rect width="16" height="16" fill="#667eea"/>
    <text x="8" y="11" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="white">M</text>
</svg>
"@

    $icon48 = @"
<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" fill="#667eea"/>
    <text x="24" y="32" font-family="Arial" font-size="30" font-weight="bold" text-anchor="middle" fill="white">M</text>
</svg>
"@

    $icon128 = @"
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" fill="#667eea"/>
    <text x="64" y="85" font-family="Arial" font-size="80" font-weight="bold" text-anchor="middle" fill="white">M</text>
</svg>
"@

    # Save SVG files
    $icon16 | Out-File -FilePath "$extPath\icon16.svg" -Encoding UTF8
    $icon48 | Out-File -FilePath "$extPath\icon48.svg" -Encoding UTF8
    $icon128 | Out-File -FilePath "$extPath\icon128.svg" -Encoding UTF8
    
    Write-Host "Created placeholder icons for $ext"
}

Write-Host "`nIcon setup complete! You can now:"
Write-Host "1. Open generate-icons.html in your browser to create PNG icons"
Write-Host "2. Or use the SVG files as placeholders"
Write-Host "3. Or replace with your own custom icons" 