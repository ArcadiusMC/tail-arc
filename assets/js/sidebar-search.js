sidebarSearchMain()

function sidebarSearchMain() {
  const searchInputId = "sidebar-search"
  const sidebarId = "side-navbar"
  let elem = document.getElementById(searchInputId)
  let sidebar = document.getElementById(sidebarId)

  if (elem == null || sidebar == null) {
    return
  }

  elem.oninput = (event) => {
    let params = event.target.value
    filterOutSidebar(sidebar, params)
  }
}

function filterOutSidebar(sidebar, params) {
  const titleAttr = "page-title"
  let children = sidebar.children

  params = params.toLowerCase().replaceAll(" ", "")
  let empty = isEmptyString(params)

  console.log(`Is empty: '${params}' = ${empty}`)

  for (let i = 0; i < children.length; i++) {
    let item = children.item(i)

    if (!item.hasAttribute(titleAttr)) {
      continue
    }

    let attr = item.getAttribute(titleAttr)
    let lower = attr.toLowerCase().replaceAll(" ", "")
    let matched = false
    
    if (empty) {
      matched = true
    } else {
      if (lower.indexOf(params) == -1) {
        matched = false
      } else {
        matched = true
      }
    }

    const hideClass = "hidden"
    let clist = item.classList
    let currentlyHidden = clist.contains(hideClass)

    if (matched) {
      clist.remove(hideClass)
    } else if (!currentlyHidden) {
      clist.add(hideClass)
    }
  }
}

function isEmptyString(str) {
  return str == null || str == "" || !(/\S+/.test(str))
}