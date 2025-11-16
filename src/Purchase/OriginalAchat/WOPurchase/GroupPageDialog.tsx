import React, { useState } from "react";
import GroupDialog, { GroupItem } from "./GroupDialog";

// Example page to show the dialog
const GroupDialogPage: React.FC = () => {
  const [open, setOpen] = useState(true);

  // Example data
  const groupName = "Sample Group";
  const items: GroupItem[] = [
    {
      id: 1,
      name: "Item 1",
      unite: "group",
      generalComment: "Sample Group",
      description: "Details for item 1",
    },
    {
      id: 2,
      name: "Item 2",
      unite: "group",
      generalComment: "Sample Group",
      description: "Details for item 2",
    },
    {
      id: 3,
      name: "Item 3",
      unite: "group",
      generalComment: "Sample Group",
      description: "Details for item 3",
    },
  ];

  return (
    <div>
      <GroupDialog
        open={open}
        onClose={() => setOpen(false)}
        groupName={groupName}
        items={items}
      />
    </div>
  );
};

export default GroupDialogPage;
