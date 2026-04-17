# Obsidian Book Search Plus

> **This is a personal fork of [obsidian-book-search-plugin](https://github.com/anpigon/obsidian-book-search-plugin) by [anpigon](https://github.com/anpigon), which has not been updated since October 2024.**
>
> The original plugin is MIT licensed. This fork exists to apply fixes and improvements that are not available upstream. If the original plugin resumes active development, prefer it over this fork.
>
> **AI disclosure:** Some of the work on this fork is written with the assistance of [Claude Code](https://claude.ai/code).

Easily create book notes.

<br>

## Changelog

To view the changelog for the latest and previous versions, please click [here](https://github.com/curtismchale/obsidian-book-search-plus/blob/main/CHANGELOG.md) to visit the GitHub releases page for the Obsidian Book Search Plugin.

<br>

## Demo

https://user-images.githubusercontent.com/3969643/184918274-8ad24546-2e01-4288-a855-c8eeb1feca7d.mp4

<br>

## Description

Use to query book using :

- A book title, author, publisher or ISBN (10 or 13).

Use Google Books API to get the book information.

<br>

## How to install

This plugin is not listed in the Obsidian community plugin directory. The easiest way to install it is via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool), which lets you install and update Obsidian plugins directly from a GitHub repository.

1. Install BRAT from the Obsidian community plugin directory.
2. In BRAT's settings, click **Add Beta Plugin** and enter `curtismchale/obsidian-book-search-plus`.
3. Enable Book Search Plus in Settings → Community plugins.

### Enhancements: Cover Image Display in Search Results

We've introduced a new setting in our plugin that allows users to display cover images alongside book suggestions in the search results. This feature aims to enrich the search experience by providing visual cues, making it easier for users to identify books at a glance. The cover images are designed to complement the textual information, offering a more engaging and intuitive search interface.

By default, this feature is **disabled** to maintain a clean, text-focused search experience. Users who prefer to keep their search results streamlined without images will find the default setting optimized for their preference.

#### Enabling Cover Images

To activate cover images in your search results:

1. Go to the plugin settings.
2. Find the **"Show Cover Images in Search"** option.
3. Switch the toggle to **on** to enable cover images.

#### CSS Styling for Cover Images

For those who enable this feature, we've added CSS styling to ensure that cover images are displayed effectively without disrupting the flow of information. To add this CSS snippet in Obsidian, you can either include it directly in your plugin's CSS file or insert it into Obsidian's custom CSS section for your vault. Here's how to add the CSS snippet for styling the book suggestions with cover images:

1. Open Obsidian.
2. Navigate to Settings > Appearance.
3. Under the CSS Snippets section, click on Open snippets folder.
4. Create a new .css file in this folder and paste the following CSS snippet into the file.
5. Go back to Obsidian, and under CSS Snippets, turn on the snippet you just added.

```css
.book-suggestion-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.book-cover-image {
  max-width: 100px;
  max-height: 100px;
  margin-right: 10px;
  object-fit: cover;
  border-radius: 3px;
}

.book-text-info {
  flex-grow: 1;
}
```

<br>

## How to use

### 1. Click the ribbon icon, or excute the command "Create new book note".

<img width="600" src="https://user-images.githubusercontent.com/3969643/161973483-ab007598-e0b8-433f-9697-75ee0ef74195.png">

### 2. Search for books by keywords.

<img width="600" src="https://user-images.githubusercontent.com/3969643/161973979-51f642c9-626a-4015-a7e9-dfdbe6ec2cbc.png">

### 3. Select the book from the search results.

<img width="600" src="https://user-images.githubusercontent.com/3969643/161974310-13c3b39b-51dc-472f-b787-db64f74caf74.png">

### 4. Voila! A note has been created.

<img width="600" src="https://user-images.githubusercontent.com/3969643/161974593-1b7bfe69-cb9d-47d7-a43d-1d725295a122.png">

<br>

## How to use settings

<img width="700"  src="https://user-images.githubusercontent.com/3969643/184919550-68eff0e4-2b02-41bb-8f17-30a5354359a3.png">

### New file location

Set the folder location where the new file is created. Otherwise, a new file is created in the Obsidian Root folder.

### New file name

You can set the file name format. The default format is `{{title}} - {{author}}`.
You can use `{{DATE}}` or `{{DATE:YYYYMMDD}}` to set a unique file name.

### Template file

You can set the template file location. There is an example template at the bottom.

### Service Provider

You can set up the services that you use to search for books. Only Google and Naver(네이버) are available now.
To use Naver Book Search, clientId and clientSecret are required. I will explain how to get clientId and clientSecret from Naver on my blog.

### Cover Image Edge Curl

By default, the Google Books API adds a "page curl" effect to image thumbnails. Disabling this toggle will remove this effect from the cover images.

### Cover Image Saving

This feature allows for the automatic downloading and saving of book cover images directly into your Obsidian vault.
By default, this option is turned off and can be activated in the plugin settings.
Upon enabling, you can designate a specific folder within your vault for storing these images, streamlining the management of book cover resources within your notes.
To include these images in your notes, use the `{{localCoverImage}}` Templater variable.

## Example template

Please also find a definition of the variables used in this template below (see: [Template variables definitions](#template-variables-definitions)).

```
---
tag: 📚Book
title: "{{title}}"
subtitle: "{{subtitle}}"
author: [{{author}}]
category: [{{category}}]
publisher: {{publisher}}
publish: {{publishDate}}
total: {{totalPage}}
isbn: {{isbn10}} {{isbn13}}
cover: {{coverUrl}}
localCover: {{localCoverImage}}
status: unread
created: {{DATE:YYYY-MM-DD HH:mm:ss}}
updated: {{DATE:YYYY-MM-DD HH:mm:ss}}
---

%% To use an image URL from the server, use the following syntax: %%
<%* if (tp.frontmatter.cover && tp.frontmatter.cover.trim() !== "") { tR += `![cover|150](${tp.frontmatter.cover})` } %>

%% To save images locally, enable the 'Enable Cover Image Save' option in the settings and enter as follows: %%
<%* if (tp.frontmatter.localCover && tp.frontmatter.localCover.trim() !== "") { tR += `![[${tp.frontmatter.localCover}|150]]` } %>

# {{title}}

```

<br>

## Dataview rendering

<img width="1024" alt="" src="https://user-images.githubusercontent.com/3969643/184546096-82ccaae6-9893-411b-aed6-a72c54f72cb2.png">

Here is the dataview query used in the demo

````
# 📚 My Bookshelf

```dataview
TABLE WITHOUT ID
	status as Status,
	rows.file.link as Book
FROM  #📚Book
WHERE !contains(file.path, "Templates")
GROUP BY status
SORT status
```

## List of all books

```dataview
TABLE WITHOUT ID
	status as Status,
	"![|60](" + cover + ")" as Cover,
	link(file.link, title) as Title,
	author as Author,
	join(list(publisher, publish)) as Publisher
FROM #📚Book
WHERE !contains(file.path, "Templates")
SORT status DESC, file.ctime ASC
```
````

The banner at the top of the document is rendered using [Obsidian-banners](https://github.com/noatpad/obsidian-banners) plugin.

<br>

## Template variables definitions

Please find here a definition of the possible variables to be used in your template. Simply write `{{name}}` in your template, and replace name by the desired book data, including:

| Field           | Description                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| title           | The title of the book.                                                                                                                             |
| subtitle        | The subtitle of the book; may be absent.                                                                                                           |
| author          | A comma-separated string containing the names of the book's authors, indicating that multiple authors can be represented within a single string.   |
| authors         | An array of strings, each element representing the name of one of the book's authors, indicating that multiple authors can be listed individually. |
| category        | A comma-separated string indicating the book's category or categories, allowing representation of multiple categories within a single string.      |
| categories      | An array of strings, each representing a different category that the book belongs to, indicating that a book can fall into multiple categories.    |
| description     | Book description.                                                                                                                                  |
| publisher       | The publisher of the book.                                                                                                                         |
| totalPage       | The total number of pages in the book.                                                                                                             |
| coverUrl        | Book cover image URL.                                                                                                                              |
| coverSmallUrl   | A smaller book cover image URL.                                                                                                                    |
| localCoverImage | Local path for the downloaded cover image. Requires activation of "Enabling Cover Images."                                                         |
| publishDate     | The year the book was published.                                                                                                                   |
| isbn10          | ISBN10                                                                                                                                             |
| isbn13          | ISBN13                                                                                                                                             |

<br>

## Advanced

### Inline Script

- The object "book" gives access to all attributes managed by the plugin.
- Using `<%= book %>` one can manipulate the different attributes, or use all attributes together.

#### To print out a book object:

````
```json
<%=book%>
```
````

or

````
```json
<%=JSON.stringify(book, null, 2)%>
```
````

#### When you want to list or link authors:

```
---
authors: <%=book.authors.map(author=>`\n  - ${author}`).join('')%>
---

authors: <%=book.authors.map(author => `[[${author}]]`).join(', ')%>
```

#### When you want to list or link categories:

```
---
categories: <%=book.categories.map(category=>`\n  - ${category}`).join('')%>
---

categories: <%=book.categories.map(category => `[[${category}]]`).join(', ')%>
```

#### When you want to isolate publication year

```
published_at: <%= book.publishDate.substring(0, 4) %>
```

#### When you want to have the publucation date under the format YYYYMMDD and not YYYY-MM-DD

```
published_at: <%= book.publishDate.replace(/-/g,'') %>
```

### How to add an API Key to bypass rate limits
If the plugin fails to fetch book metadata, it might be that you have hit the free API rate limits, and need to add an API key.

Here's how to create and use one:
- Create a project on [Google Cloud](https://console.cloud.google.com/projectcreate)
- Enable the Books API for your project using the [Books API page](https://console.cloud.google.com/apis/library/books.googleapis.com)
- Create an API key for your Google Cloud project using the [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) page
- To limit the security risks of losing that key, you can edit it, and click on "Restrict key" under "API restrictions", then select only the "Books API" API
- Add the API key to the settings of the Book Search plugin, under "Set API Key"
- Once added, click on "Save", then "API Check"


<br>

## License

[Obsidian Book Search Plugin](https://github.com/anpigon/obsidian-book-search-plugin) is licensed under the GNU AGPLv3 license. Refer to [LICENSE](https://github.com/SilentVoid13/Templater/blob/master/LICENSE.TXT) for more information.

<br>

## Contributing

Feel free to contribute.

You can create an [issue](https://github.com/anpigon/obsidian-book-search-plugin/issues) to report a bug, suggest an improvement for this plugin, ask a question, etc.

You can make a [pull request](https://github.com/anpigon/obsidian-book-search-plugin/pulls) to contribute to this plugin development.

<br>

## Support

If this plugin helped you, consider [sponsoring via GitHub](https://github.com/sponsors/curtismchale).
