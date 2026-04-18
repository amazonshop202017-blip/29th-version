import { useNavigate, useParams } from "react-router-dom";
import PropFirmAccountDetails from "@/components/propfirm/PropFirmAccountDetails";
import RealPropFirmAccountDetails from "@/components/propfirm/RealPropFirmAccountDetails";

const PropFirmAccountDetailsPage = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const onBack = () => navigate("/prop-firm/accounts");

  if (!accountId) return null;
  if (accountId === "demo") return <PropFirmAccountDetails onBack={onBack} />;
  return <RealPropFirmAccountDetails accountId={accountId} onBack={onBack} />;
};

export default PropFirmAccountDetailsPage;
