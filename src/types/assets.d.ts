declare module '*.sql' {
  const content: string;
  export default content;
}

declare module '*.db' {
  const assetId: number;
  export default assetId;
}
