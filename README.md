# Portfolio Content Repository

This repository serves as the content layer for the portfolio website.

The frontend application consumes these files and renders them dynamically.

## Structure

```txt
projects/
    index.mdx
    *.mdx

writing/
    *.mdx

about/
    index.mdx

stack/
    index.mdx
```

## Project Routing

Listing page:

```txt
/projects
```

Detail page:

```txt
/projects?id={slug}
```

Example:

```txt
/projects?id=xcm-precompile-assethub
```

The frontend should:

1. Read projects/index.mdx
2. Extract all project metadata
3. Build filters
4. Render cards
5. Resolve project detail pages using slug

## Frontmatter Convention

Every project must contain:

```yaml
title:
slug:
summary:
featured:
status:
tags:
year:
```

## Future Extensions

Supported additions:

- github
- website
- demo
- article
- screenshots
- videos
- architecture diagrams
- metrics
- testimonials
- timeline
