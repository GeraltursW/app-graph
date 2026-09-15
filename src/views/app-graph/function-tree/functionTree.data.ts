function flattenFunctionNodes(roots: any[]) {
  const rows: any[] = [];
  const visit = (node: any, parentId: string | null, depth: number) => {
    rows.push({
      functionId: String(node.functionId),
      parentId: node.parentFunctionId ? String(node.parentFunctionId) : parentId,
      level: Number(node.level) || depth,
      functionName: node.name || '未命名功能',
      functionDescription: node.description || '',
      functionPath: node.functionPath || '',
      automationLimited: Boolean(node.automationLimited),
      features: node.features || [],
      expectedCapabilities: node.expectedCapabilities || [],
      matchRules: node.matchRules || {},
    });
    (node.children || []).forEach((child: any) => {
      visit(child, String(node.functionId), depth + 1);
    });
  };
  (roots || []).forEach((root) => visit(root, null, 1));
  return rows;
}

export function createFunctionCatalogView(
  catalogPayload: any,
  bindingsPayload: any = {},
  run: any = null,
  coveragePayload: any = {},
) {
  const pageBindings = bindingsPayload.pageBindings || [];
  const actionBindings = bindingsPayload.actionBindings || [];
  const pagesByFunction = new Map<string, any[]>();
  const actionsByFunction = new Map<string, any[]>();
  const coverageByFunction = new Map(
    (coveragePayload.functions || []).map((item: any) => [String(item.functionId), item]),
  );

  pageBindings.forEach((binding: any) => {
    const key = String(binding.functionId);
    if (!pagesByFunction.has(key)) pagesByFunction.set(key, []);
    pagesByFunction.get(key)!.push(binding);
  });
  actionBindings.forEach((binding: any) => {
    const key = String(binding.functionId);
    if (!actionsByFunction.has(key)) actionsByFunction.set(key, []);
    actionsByFunction.get(key)!.push(binding);
  });

  const catalog = catalogPayload.catalog || {};
  return {
    catalogId: String(catalog.catalogId || ''),
    source: catalog.source || '厂商 Function Tree',
    version: catalog.vendorVersion || catalog.appVersion || '',
    appVersion: catalog.appVersion || '',
    run,
    functions: flattenFunctionNodes(catalogPayload.roots).map((item) => ({
      ...item,
      pageBindings: pagesByFunction.get(item.functionId) || [],
      actionBindings: actionsByFunction.get(item.functionId) || [],
      coverage: coverageByFunction.get(item.functionId) || {},
      hasBindingSnapshot: Boolean(run),
    })),
  };
}

export function createEmptyFunctionCatalog(message = '当前应用暂无 Function Tree') {
  return {
    catalogId: '',
    source: message,
    version: '',
    appVersion: '',
    run: null,
    functions: [],
  };
}
