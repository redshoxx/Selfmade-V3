'use strict'
const fs=require('node:fs')
const vm=require('node:vm')
const assert=require('node:assert/strict')

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const cap=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'))
const bridge=fs.readFileSync('native-v44.js','utf8')
const index=fs.readFileSync('index.html','utf8')
const sw=fs.readFileSync('sw.js','utf8')
const api=fs.readFileSync('api/product-lookup.js','utf8')
const workflow=fs.readFileSync('.github/workflows/ios-sideload.yml','utf8')

assert.equal(pkg.version,'4.4.0')
assert.equal(pkg.dependencies['@capacitor/core'],'8.4.2')
assert.equal(pkg.dependencies['@capacitor/ios'],'8.4.2')
assert.equal(pkg.devDependencies['@capacitor/cli'],'8.4.2')
assert.equal(pkg.devDependencies['@capacitor/assets'],'3.0.5')
assert.equal(cap.appId,'at.nest.selfmade')
assert.equal(cap.appName,'NEST')
assert.equal(cap.webDir,'dist')
assert.ok(index.includes('/native-v44.js?v=4.4.0-r20'),'Native Bridge wird nicht geladen')
assert.ok(index.indexOf('/native-v44.js')<index.indexOf('/app-v3.js'),'Native Bridge muss vor App-Code laden')
assert.ok(sw.includes("nest-v4.4.0-r20")&&sw.includes('/native-v44.js?v=4.4.0-r20'),'Native Bridge fehlt im PWA-Cache')
assert.ok(api.includes("Access-Control-Allow-Origin','*'"),'Produkt-API erlaubt native iOS-Origin nicht')
assert.ok(workflow.includes('runs-on: macos-15'),'iOS Build benötigt macOS')
assert.ok(workflow.includes('pod --version'),'CocoaPods-Prüfung fehlt')
assert.ok(workflow.includes('npx cap add ios --packagemanager Cocoapods'),'Capacitor 8 muss explizit CocoaPods verwenden')
assert.ok(workflow.includes('test -f ios/App/Podfile'),'Podfile-Prüfung fehlt')
assert.ok(workflow.includes('test -d ios/App/App.xcworkspace'),'Workspace-Prüfung fehlt')
assert.ok(workflow.includes('-workspace ios/App/App.xcworkspace'),'CocoaPods Xcode-Workspace fehlt')
assert.ok(!workflow.includes('--packagemanager SPM'),'SPM darf im stabilen Sideloadly-Build nicht aktiv sein')
assert.ok(workflow.includes('CODE_SIGNING_ALLOWED=NO'),'Unsigned iOS Build fehlt')
assert.ok(!workflow.includes("PRODUCT_BUNDLE_IDENTIFIER='at.nest.selfmade'"),'App-Bundle-ID darf nicht global an Framework-Targets vererbt werden')
assert.ok(workflow.includes("test \"$APP_ID\" = 'at.nest.selfmade'"),'App-Bundle-ID wird nach dem Build nicht verifiziert')
assert.ok(workflow.includes('Embedded bundle $RELATIVE verwendet fälschlich die App-ID'),'Framework/App Bundle-ID-Kollision wird nicht geprüft')
assert.ok(workflow.includes('uniq -d'),'Doppelte Framework-Bundle-IDs werden nicht erkannt')
assert.ok(workflow.includes('CFBundleShortVersionString 4.4.0'),'App-Version wird nicht gezielt auf der fertigen App gesetzt')
assert.ok(workflow.includes('NSCameraUsageDescription'),'Kamera-Berechtigung fehlt')
assert.ok(workflow.includes('NEST-v4.4.0-Sideloadly.ipa'),'Sideloadly IPA-Datei fehlt')
assert.ok(workflow.includes('/usr/bin/unzip -t NEST-v4.4.0-Sideloadly.ipa'),'IPA-Integritätsprüfung fehlt')
assert.ok(workflow.includes("Print :CFBundleExecutable"),'Executable-Prüfung muss dynamisch aus Info.plist kommen')
assert.ok(workflow.includes('NEST-iOS-build-diagnostics'),'Fehlerdiagnose-Artefakt fehlt')
assert.ok(workflow.includes('actions/upload-artifact@v4'),'IPA-Artefakt wird nicht bereitgestellt')

const context={
  console,
  Promise,
  URL,
  Request:global.Request,
  location:{protocol:'capacitor:',origin:'capacitor://localhost'},
  document:{documentElement:{dataset:{}}},
  navigator:{},
  fetch:async()=>({ok:true}),
  globalThis:null
}
context.globalThis=context
vm.runInNewContext(bridge,context,{filename:'native-v44.js',timeout:1000})
assert.equal(context.NestNativeV44.isNative,true)
assert.equal(context.NestNativeV44.platform,'ios')
assert.equal(context.NestNativeV44.apiUrl('/api/product-lookup?barcode=123'),'https://selfmade-v3.vercel.app/api/product-lookup?barcode=123')
assert.equal(context.document.documentElement.dataset.nestNative,'ios')

console.log('NEST V4.4.0 iOS Capacitor and Sideloadly IPA regression tests passed')
