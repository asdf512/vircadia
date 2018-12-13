//
//  AvatarProject.cpp
//
//
//  Created by Thijs Wenker on 12/7/2018
//  Copyright 2018 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include "AvatarProject.h"

#include <FSTReader.h>

#include <QFile>
#include <QFileInfo>
#include <QUrl>
#include <QDebug>

AvatarProject* AvatarProject::openAvatarProject(const QString& path) {
    const auto pathToLower = path.toLower();
    if (pathToLower.endsWith(".fst")) {
        QFile file{ path };
        if (!file.open(QIODevice::ReadOnly)) {
            return nullptr;
        }
        return new AvatarProject(path, file.readAll());
    }

    if (pathToLower.endsWith(".fbx")) {
        // TODO: Create FST here:
    }

    return nullptr;
}

AvatarProject::AvatarProject(const QString& fstPath, const QByteArray& data) :
    _fstPath(fstPath), _fst(fstPath, FSTReader::readMapping(data)) {

    _directory = QFileInfo(_fstPath).absoluteDir();

    //_projectFiles = _directory.entryList();
    refreshProjectFiles();

    auto fileInfo = QFileInfo(_fstPath);
    _projectPath = fileInfo.absoluteDir().absolutePath();
}

void AvatarProject::appendDirectory(QString prefix, QDir dir) {
    qDebug() << "Inside of " << prefix << dir.absolutePath();
    auto flags = QDir::Dirs | QDir::Files | QDir::NoSymLinks | QDir::NoDotAndDotDot | QDir::Hidden;
    for (auto& entry : dir.entryInfoList({}, flags)) {
        if (entry.isFile()) {
            _projectFiles.append(prefix + "/" + entry.fileName());
        } else if (entry.isDir()) {
            qDebug() << "Found dir " << entry.absoluteFilePath() << " in " << dir.absolutePath();
            appendDirectory(prefix + dir.dirName() + "/", entry.absoluteFilePath());
        }
    }
}

void AvatarProject::refreshProjectFiles() {
    _projectFiles.clear();
    appendDirectory("", _directory);
}
