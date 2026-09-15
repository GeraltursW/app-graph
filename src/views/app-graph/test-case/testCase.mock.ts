export const testCaseCatalogs = {
  QQ: [],
};

export function getTestCaseCatalog(appName: string) {
  return testCaseCatalogs[appName as keyof typeof testCaseCatalogs] || [];
}
