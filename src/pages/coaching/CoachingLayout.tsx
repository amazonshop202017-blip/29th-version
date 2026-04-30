import { Outlet, useLocation, useNavigate } from "react-router-dom";

type Tab = "mentor" | "student";

const CoachingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab: Tab = location.pathname.startsWith("/coaching/student")
    ? "student"
    : "mentor";

  const setActiveTab = (tab: Tab) => {
    navigate(tab === "mentor" ? "/coaching/mentor" : "/coaching/student");
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">
          Coaching workspace for mentors and students
        </p>
      </div>

      {/* Primary Tabs */}
      <div className="flex items-center gap-1">
        {([
          { key: "mentor" as Tab, label: "Mentor Mode" },
          { key: "student" as Tab, label: "Student Mode" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? "border border-border bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Outlet />
    </div>
  );
};

export default CoachingLayout;