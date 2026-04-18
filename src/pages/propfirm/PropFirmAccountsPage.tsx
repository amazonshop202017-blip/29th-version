import { useNavigate } from "react-router-dom";
import PropFirmAccounts from "@/components/propfirm/PropFirmAccounts";

const PropFirmAccountsPage = () => {
  const navigate = useNavigate();
  return (
    <PropFirmAccounts
      onSelectAccount={(id) => {
        if (id) navigate(`/prop-firm/accounts/${id}`);
      }}
    />
  );
};

export default PropFirmAccountsPage;
