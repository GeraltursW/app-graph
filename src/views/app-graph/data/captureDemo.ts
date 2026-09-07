export async function createCaptureDemo(appName:string) {
  const {default:ExcelJS}=await import('exceljs');const {default:JSZip}=await import('jszip');
  const {mockGovernance}=await import('@/mock/appGraph');const {captureHeaders}=await import('./capturePackage');
  const work=await mockGovernance('/orphans/workbench',{appName});const parent=work.nodes.find(n=>n.reachable);
  const zip=new JSZip(),book=new ExcelJS.Workbook(),sheet=book.addWorksheet('人工采集');sheet.addRow(Object.keys(captureHeaders));
  const rows=[{appName,recordId:'B',pageUrl:'demo://capture/list',pageTitle:'人工采集示例列表',pageImage:'screenshots/list.png',widgetImage:'screenshots/control.png',parentPageId:parent?.pageId||'',widgetDescription:'示例入口',actionType:'tap'},
    {appName,recordId:'C',pageUrl:'demo://capture/detail',pageTitle:'人工采集示例详情',pageImage:'screenshots/detail.png',previousRecordId:'B',widgetDescription:'查看详情',actionType:'tap'},
    {appName,recordId:'D',pageUrl:'demo://capture/unknown',pageTitle:'待确认独立区域',pageImage:'screenshots/unknown.png'}];
  for(const row of rows) sheet.addRow(Object.values(captureHeaders).map(key=>row[key]||''));
  zip.file('records.xlsx',await book.xlsx.writeBuffer());
  for(const [index,name] of ['list','detail','unknown','control'].entries()) {
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=name==='control'?100:700;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f3f6fb';ctx.fillRect(0,0,360,700);ctx.fillStyle='#1668dc';ctx.fillRect(0,0,360,86);
    ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText(name==='control'?'查看详情':rows[index].pageTitle,20,50);
    if(name!=='control') {ctx.fillStyle='#fff';ctx.fillRect(20,110,320,440);ctx.fillStyle='#334155';ctx.font='18px sans-serif';ctx.fillText('人工采集 · 演示截图',40,155);ctx.fillText('页面结构及操作证据',40,190);ctx.fillStyle='#1668dc';ctx.fillRect(40,240,280,52);ctx.fillStyle='#fff';ctx.fillText('查看详情',120,273);}
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));zip.file('screenshots/'+name+'.png',blob);
  }
  return new File([await zip.generateAsync({type:'blob'})],'人工采集示例.zip',{type:'application/zip'});
}
