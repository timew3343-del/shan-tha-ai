import { useState } from "react";
import { BottomNavigation } from "@/components/BottomNavigation";
import { AIToolsTab } from "@/components/AIToolsTab";
import { DosDontsTab } from "@/components/DosDontsTab";
import { CourseTab } from "@/components/CourseTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState("ai-tools");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto">
        {activeTab === "ai-tools" && <AIToolsTab />}
        {activeTab === "dos-donts" && <DosDontsTab />}
        {activeTab === "course" && <CourseTab />}
      </div>
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
