import type { UniHwpEngine } from './uni-hwp-engine';

// This is a compile-time guard for the product boundary.  The test does not
// import the generated RHWP module, so a replacement engine can satisfy the
// product contract without bringing RHWP types into product code.
type ProductEngine = UniHwpEngine;

type Assert<T extends true> = T;
type HasMember<T, K extends PropertyKey> = K extends keyof T ? true : false;

type _HasDocumentLifecycle = Assert<HasMember<ProductEngine, 'loadDocument'>>;
type _HasRendering = Assert<HasMember<ProductEngine, 'renderPageSvg'>>;
type _HasDisposal = Assert<HasMember<ProductEngine, 'dispose'>>;
type _HasPageHideRead = Assert<HasMember<ProductEngine, 'getPageHide'>>;
type _HasPageHideWrite = Assert<HasMember<ProductEngine, 'setPageHide'>>;
type _HasRangeReplace = Assert<HasMember<ProductEngine, 'replaceRange'>>;
type _HasVersionInfo = Assert<HasMember<ProductEngine, 'getVersionInfo'>>;
type _HasCapabilities = Assert<HasMember<ProductEngine, 'getCapabilities'>>;

export {};
