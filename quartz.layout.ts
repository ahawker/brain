import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { FileNode } from "./quartz/components/ExplorerNode"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/ahawker",
      Blog: "https://andrew.hawker.io",
      LinkedIn: "https://linkedin.com/in/ahawker",
      Email: "mailto:andrew.r.hawker@gmail.com"
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Darkmode(),
    Component.Search(),
    Component.DesktopOnly(Component.Explorer({
      title: "Pages",
      sortFn: explorerSort,
    })),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Graph(),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Darkmode(),
    Component.Search(),
    Component.DesktopOnly(Component.Explorer({
      title: "Pages",
      sortFn: explorerSort,
    })),
  ],
  right: [],
}

function explorerSort(a: FileNode, b: FileNode) {
  if ((!a.file && !b.file) || (a.file && b.file)) {
    // sensitivity: "base": Only strings that differ in base letters compare as unequal. Examples: a ≠ b, a = á, a = A
    // numeric: true: Whether numeric collation should be used, such that "1" < "2" < "10"
    // note: we reverse the order so we remain asc order
    return -1 * a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }
  if (a.file && !b.file) {
    return -1
  } else {
    return 1
  }
}