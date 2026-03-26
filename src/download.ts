import { normalizePath, Notice, requestUrl } from "obsidian";

import { relative, join, parse } from "path-browserify";
import imageType from "image-type";

import { getUrlAsset, uuid } from "./utils";
import { t } from "./lang/helpers";
import type imageAutoUploadPlugin from "./main";

export async function downloadAllImageFiles(plugin: imageAutoUploadPlugin) {
  const activeFile = plugin.app.workspace.getActiveFile();
  let folderPath = await plugin.app.fileManager.getAvailablePathForAttachment(
    ""
  );

  if (plugin.settings.customDownloadPath) {
    const parentPath = activeFile.parent.path;
    const filename = activeFile.basename;
    const customPath = plugin.settings.customDownloadPath.replace(
      "${filename}",
      filename
    );
    folderPath = normalizePath(join(parentPath, customPath));
  }

  const fileArray = plugin.helper.getAllFiles();

  if (!(await plugin.app.vault.adapter.exists(folderPath))) {
    await plugin.app.vault.adapter.mkdir(folderPath);
  }

  let imageArray = [];
  for (const file of fileArray) {
    if (!file.path.startsWith("http")) {
      continue;
    }

    const url = file.path;
    const asset = getUrlAsset(url);
    let name = decodeURI(parse(asset).name).replaceAll(/[\\\\/:*?\"<>|]/g, "-");

    const response = await download(plugin, url, folderPath, name);
    if (response.ok) {
      const activeFolder = plugin.app.workspace.getActiveFile().parent.path;
      const relativePath = normalizePath(
        relative(normalizePath(activeFolder), normalizePath(response.path))
      );

      // 更新映射
      plugin.imageStore.set(response.path, url);

      imageArray.push({
        source: file.source,
        name: name,
        path: relativePath,
      });
    }
  }

  const internetImages = fileArray.filter(file => file.path.startsWith("http"));

  new Notice(
    `${t("Download complete")}\n${t("All")}: ${internetImages.length}\n${t("Success")}: ${imageArray.length}\n${t("Failed")}: ${
      internetImages.length - imageArray.length
    }`
  );
}

async function download(
  plugin: imageAutoUploadPlugin,
  url: string,
  folderPath: string,
  name: string
) {
  const response = await requestUrl({ url });

  if (response.status !== 200) {
    return {
      ok: false,
      msg: "error",
    };
  }

  const type = await imageType(new Uint8Array(response.arrayBuffer));
  if (!type) {
    return {
      ok: false,
      msg: "error",
    };
  }

  try {
    let path = normalizePath(join(folderPath, `${name}.${type.ext}`));

    // 如果文件名已存在，则用随机值替换，不对文件后缀进行判断
    if (await plugin.app.vault.adapter.exists(path)) {
      path = normalizePath(join(folderPath, `${uuid()}.${type.ext}`));
    }

    plugin.app.vault.adapter.writeBinary(path, response.arrayBuffer);
    return {
      ok: true,
      msg: "ok",
      path: path,
      type,
    };
  } catch (err) {
    return {
      ok: false,
      msg: err,
    };
  }
}
