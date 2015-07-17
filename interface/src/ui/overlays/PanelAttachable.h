//
//  PanelAttachable.h
//  interface/src/ui/overlays
//
//  Created by Zander Otavka on 7/1/15.
//  Copyright 2014 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#ifndef hifi_PanelAttachable_h
#define hifi_PanelAttachable_h

#include "FloatingUIPanel.h"

#include <glm/glm.hpp>

class PanelAttachable {
public:
    PanelAttachable();
    PanelAttachable(const PanelAttachable* panelAttachable);

    glm::vec3 getOffsetPosition() const { return _offsetPosition; }
    void setOffsetPosition(glm::vec3 position) { _offsetPosition = position; }

    FloatingUIPanel* getAttachedPanel() const { return _attachedPanel; }
    void setAttachedPanel(FloatingUIPanel* panel) { _attachedPanel = panel; }

    glm::vec3 getTranslatedPosition(glm::vec3 avatarPosition) const;
    glm::quat getTranslatedRotation(glm::quat offsetRotation) const;

private:
    FloatingUIPanel* _attachedPanel;
    glm::vec3 _offsetPosition = glm::vec3(0, 0, 0);
};

#endif // hifi_PanelAttachable_h
